import io
import pytest
from unittest.mock import patch, MagicMock
from sqlalchemy.exc import OperationalError

from backend.app.services.pdf_service import extract_text_from_pdf, PDFCorruptedError, PDFEmptyError
from backend.app.services.validation_engine import validate_invoice_data
from backend.app.services.gemini_service import extract_invoice_data_with_gemini
from backend.app.services.report_service import generate_excel_expense_report
from backend.app.schemas.report import ReportFilterParams
from backend.app.schemas.invoice import InvoiceExtractionSchema
from backend.app.models.invoice import Invoice
from backend.tests.conftest import generate_pdf_with_text, generate_scanned_pdf

# ============================================================================
# Scenario 1: Valid text-based invoice PDF
# ============================================================================
def test_scenario_01_valid_text_invoice_upload(client):
    lines = [
        "Vendor: Apex Tech Solutions",
        "Invoice Number: INV-2026-901",
        "Invoice Date: 2026-03-15",
        "Due Date: 2026-04-15",
        "Customer: Global Logistics Inc",
        "Subtotal: $1000.00",
        "Tax (10%): $100.00",
        "Total Amount: $1100.00",
        "Status: PENDING"
    ]
    pdf_bytes = generate_pdf_with_text(lines)
    
    files = {"files": ("apex_invoice.pdf", pdf_bytes, "application/pdf")}
    response = client.post("/api/v1/invoices/upload", files=files)
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    invoice = data[0]
    assert invoice["vendor_name"] == "Apex Tech Solutions"
    assert invoice["invoice_number"] == "INV-2026-901"
    assert invoice["subtotal"] == 1000.0
    assert invoice["tax_amount"] == 100.0
    assert invoice["total_amount"] == 1100.0
    assert invoice["status"] in ("PENDING_REVIEW", "FLAGGED")
    assert invoice["file_hash"] is not None

# ============================================================================
# Scenario 2: Scanned invoice PDF
# ============================================================================
def test_scenario_02_scanned_invoice_ocr_fallback(tmp_path):
    lines = ["Scanned Invoice Copy", "Vendor: Scanned Paper Supplies"]
    scanned_bytes = generate_scanned_pdf(lines)
    
    test_file = tmp_path / "scanned_doc.pdf"
    test_file.write_bytes(scanned_bytes)
    
    text, is_scanned, meta = extract_text_from_pdf(test_file)
    # Because it is an image-based PDF, direct text extraction returns empty/sparse text
    assert is_scanned is True
    assert len(text.strip()) < 50

# ============================================================================
# Scenario 3: Invalid / Corrupted PDF
# ============================================================================
def test_scenario_03_invalid_pdf_handling(client):
    corrupted_bytes = b"NOT_A_REAL_PDF_HEADER_DATA_12345"
    files = {"files": ("corrupt.pdf", corrupted_bytes, "application/pdf")}
    
    response = client.post("/api/v1/invoices/upload", files=files)
    assert response.status_code == 400
    assert "Corrupted or unreadable PDF" in response.json()["detail"]

# ============================================================================
# Scenario 4: Empty PDF (0 bytes or 0 pages)
# ============================================================================
def test_scenario_04_empty_pdf_handling(client):
    empty_bytes = b""
    files = {"files": ("empty.pdf", empty_bytes, "application/pdf")}
    
    response = client.post("/api/v1/invoices/upload", files=files)
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()

# ============================================================================
# Scenario 5: Missing invoice number (Flags for human review)
# ============================================================================
def test_scenario_05_missing_invoice_number_validation(client):
    lines = [
        "Vendor: Delta Logistics",
        "Invoice Date: 2026-02-10",
        "Subtotal: $500.00",
        "Tax: $50.00",
        "Total Amount: $550.00"
    ]
    pdf_bytes = generate_pdf_with_text(lines)
    files = {"files": ("no_number_inv.pdf", pdf_bytes, "application/pdf")}
    
    response = client.post("/api/v1/invoices/upload", files=files)
    assert response.status_code == 200
    invoice = response.json()[0]
    assert invoice["status"] == "FLAGGED"
    assert any("Missing invoice number" in w for w in invoice["validation_warnings"])

# ============================================================================
# Scenario 6: Incorrect total amount (Subtotal + Tax != Total)
# ============================================================================
def test_scenario_06_inconsistent_total_validation(client):
    lines = [
        "Vendor: Sigma Hardware",
        "Invoice Number: SIG-992",
        "Invoice Date: 2026-03-01",
        "Subtotal: $200.00",
        "Tax: $20.00",
        "Total Amount: $450.00"  # Expected: 220.00, mismatch!
    ]
    pdf_bytes = generate_pdf_with_text(lines)
    files = {"files": ("sigma_mismatch.pdf", pdf_bytes, "application/pdf")}
    
    response = client.post("/api/v1/invoices/upload", files=files)
    assert response.status_code == 200
    invoice = response.json()[0]
    assert invoice["status"] == "FLAGGED"
    assert any("Total amount mismatch" in w for w in invoice["validation_warnings"])

# ============================================================================
# Scenario 7: Duplicate invoice prevention
# ============================================================================
def test_scenario_07_duplicate_upload_prevention(client):
    lines = [
        "Vendor: DupCheck Corp",
        "Invoice Number: DUP-001",
        "Invoice Date: 2026-01-20",
        "Total Amount: $75.00"
    ]
    pdf_bytes = generate_pdf_with_text(lines)
    files = {"files": ("dup_check.pdf", pdf_bytes, "application/pdf")}
    
    # First upload succeeds
    r1 = client.post("/api/v1/invoices/upload", files=files)
    assert r1.status_code == 200
    
    # Second upload with identical bytes should trigger conflict (409)
    files2 = {"files": ("dup_check.pdf", pdf_bytes, "application/pdf")}
    r2 = client.post("/api/v1/invoices/upload", files=files2)
    assert r2.status_code == 409
    assert "duplicate upload" in r2.json()["detail"].lower()

# ============================================================================
# Scenario 8: AI extraction failure with graceful fallback
# ============================================================================
def test_scenario_08_gemini_extraction_failure_handling():
    with patch("backend.app.config.settings.GEMINI_API_KEY", "dummy_key"):
        with patch("google.generativeai.GenerativeModel") as mock_model:
            mock_instance = MagicMock()
            mock_instance.generate_content.side_effect = Exception("Rate limit exceeded or API error")
            mock_model.return_value = mock_instance
            
            raw_text = "Vendor: Fallback Vendor\nInvoice Number: FB-101\nTotal Amount: $300.00"
            schema, meta, is_demo = extract_invoice_data_with_gemini(raw_text)
            
            # Ensures it safely falls back to deterministic parsing without crashing
            assert is_demo is True
            assert schema.vendor_name == "Fallback Vendor"
            assert schema.invoice_number == "FB-101"
            assert schema.total_amount == 300.0

# ============================================================================
# Scenario 9: Database connection failure resilience
# ============================================================================
def test_scenario_09_database_connection_failure():
    # Test that when database query raises OperationalError, proper handling occurs
    from backend.app.api.v1.invoices import list_invoices
    mock_db = MagicMock()
    mock_db.query.side_effect = OperationalError("connection refused", {}, None)
    
    with pytest.raises(Exception):
        list_invoices(page=1, page_size=10, db=mock_db)

# ============================================================================
# Scenario 10: Excel report generation
# ============================================================================
def test_scenario_10_excel_report_generation(db_session):
    # Seed an invoice
    inv = Invoice(
        file_name="report_test.pdf",
        file_path="/tmp/report_test.pdf",
        file_hash="fake_hash_12345",
        file_size=1024,
        status="APPROVED",
        vendor_name="Acme Cloud Services",
        invoice_number="REP-9901",
        invoice_date="2026-03-10",
        subtotal=800.0,
        tax_amount=80.0,
        total_amount=880.0,
        currency="USD"
    )
    db_session.add(inv)
    db_session.commit()
    
    filters = ReportFilterParams(approved_only=True)
    excel_bytes = generate_excel_expense_report(db=db_session, filters=filters)
    
    assert len(excel_bytes) > 0
    # Check openpyxl can read it back and find sheets
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(excel_bytes))
    assert "Executive Summary" in wb.sheetnames
    assert "Detailed Invoices" in wb.sheetnames

# ============================================================================
# Scenario 11: Invoice human correction and approval workflow
# ============================================================================
def test_scenario_11_correction_and_approval_workflow(client):
    # Upload an invoice with missing total
    lines = [
        "Vendor: Creative Media Agency",
        "Invoice Number: CMA-404",
        "Invoice Date: 2026-03-20"
    ]
    pdf_bytes = generate_pdf_with_text(lines)
    files = {"files": ("cma_invoice.pdf", pdf_bytes, "application/pdf")}
    r = client.post("/api/v1/invoices/upload", files=files)
    assert r.status_code == 200
    inv_id = r.json()[0]["id"]
    
    # 1. Edit / Correct total amount and subtotal
    update_payload = {
        "subtotal": 1200.0,
        "tax_amount": 120.0,
        "total_amount": 1320.0
    }
    r_patch = client.patch(f"/api/v1/invoices/{inv_id}", json=update_payload)
    assert r_patch.status_code == 200
    updated = r_patch.json()
    assert updated["is_corrected"] is True
    assert updated["total_amount"] == 1320.0
    assert "total_amount" in updated["corrected_fields"]
    
    # 2. Approve invoice
    r_approve = client.post(
        f"/api/v1/invoices/{inv_id}/status",
        json={"status": "APPROVED", "notes": "Verified by Accounting Senior"}
    )
    assert r_approve.status_code == 200
    assert r_approve.json()["status"] == "APPROVED"
    assert r_approve.json()["approved_at"] is not None

# ============================================================================
# Scenario 12: Search and filtering
# ============================================================================
def test_scenario_12_search_and_filtering(client):
    # Seed 2 invoices
    inv1_lines = ["Vendor: Alpha Prime Corp", "Invoice Number: AL-111", "Invoice Date: 2026-01-10", "Total Amount: $500.00"]
    inv2_lines = ["Vendor: Beta Logistics", "Invoice Number: BE-222", "Invoice Date: 2026-02-15", "Total Amount: $1500.00"]
    
    client.post("/api/v1/invoices/upload", files={"files": ("alpha.pdf", generate_pdf_with_text(inv1_lines), "application/pdf")})
    client.post("/api/v1/invoices/upload", files={"files": ("beta.pdf", generate_pdf_with_text(inv2_lines), "application/pdf")})
    
    # Search by vendor keyword "Alpha"
    r_search = client.get("/api/v1/invoices?search=Alpha")
    assert r_search.status_code == 200
    items = r_search.json()["items"]
    assert any("Alpha" in i["vendor_name"] for i in items)
    assert not any("Beta" in (i["vendor_name"] or "") for i in items)
    
    # Filter by min_amount 1000
    r_filter = client.get("/api/v1/invoices?min_amount=1000")
    assert r_filter.status_code == 200
    for item in r_filter.json()["items"]:
        assert item["total_amount"] >= 1000.0

# ============================================================================
# Scenario 13: Prometheus metrics endpoint
# ============================================================================
def test_scenario_13_metrics_endpoint(client):
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "http_requests" in response.text or "process_cpu_seconds" in response.text

# ============================================================================
# Scenario 14: Liveness and Readiness health endpoints
# ============================================================================
def test_scenario_14_health_and_readiness_endpoints(client):
    r_health = client.get("/health")
    assert r_health.status_code == 200
    assert r_health.json()["status"] == "healthy"

    r_ready = client.get("/ready")
    assert r_ready.status_code == 200
    assert r_ready.json()["status"] == "ready"
    assert r_ready.json()["database"] == "connected"

