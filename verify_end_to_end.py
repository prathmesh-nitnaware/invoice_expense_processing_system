import io
import os
import sys

# Configure environment for local verification
os.environ["DATABASE_URL"] = "sqlite:///./verify_workflow.db"
os.environ["DEMO_MODE"] = "true"

from fastapi.testclient import TestClient
import openpyxl
from backend.app.main import app
from backend.app.database import Base, engine
from backend.tests.conftest import generate_pdf_with_text

def run_verification():
    print("=" * 70)
    print("STARTING END-TO-END INVOICE AUTOMATION WORKFLOW VERIFICATION")
    print("=" * 70)

    # 1. Initialize schema
    print("\n[Step 1] Initializing fresh database schema...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("Database schema successfully created.")

    client = TestClient(app)

    # 2. Upload multiple invoices
    print("\n[Step 2] Uploading realistic business invoices...")
    
    # Invoice 1: Acme Cloud
    inv1_lines = [
        "Vendor: Amazon Web Services Inc",
        "Invoice Number: AWS-2026-8812",
        "Invoice Date: 2026-02-15",
        "Due Date: 2026-03-15",
        "Customer: Enterprise Cloud Agency",
        "Subtotal: $2500.00",
        "Tax (10%): $250.00",
        "Total Amount: $2750.00",
        "Status: PENDING"
    ]
    pdf1 = generate_pdf_with_text(inv1_lines)

    # Invoice 2: Office Supplies (Intentional mismatch to test Flagging)
    inv2_lines = [
        "Vendor: Staples Office Supplies",
        "Invoice Number: STP-9910",
        "Invoice Date: 2026-02-20",
        "Subtotal: $400.00",
        "Tax: $40.00",
        "Total Amount: $520.00"  # Mismatch: 440 != 520
    ]
    pdf2 = generate_pdf_with_text(inv2_lines)

    # Invoice 3: Creative Studio
    inv3_lines = [
        "Vendor: Figma Design Systems",
        "Invoice Number: FIG-4411",
        "Invoice Date: 2026-03-01",
        "Total Amount: $360.00"
    ]
    pdf3 = generate_pdf_with_text(inv3_lines)

    upload_payload = [
        ("files", ("aws_invoice.pdf", pdf1, "application/pdf")),
        ("files", ("staples_invoice.pdf", pdf2, "application/pdf")),
        ("files", ("figma_invoice.pdf", pdf3, "application/pdf")),
    ]

    r_upload = client.post("/api/v1/invoices/upload", files=upload_payload)
    assert r_upload.status_code == 200, f"Upload failed: {r_upload.text}"
    uploaded = r_upload.json()
    assert len(uploaded) == 3, f"Expected 3 invoices, got {len(uploaded)}"
    print(f"Successfully processed {len(uploaded)} invoices via extraction pipeline:")
    for inv in uploaded:
        print(f"  - Invoice #{inv['id']}: Vendor='{inv['vendor_name']}', Total=${inv['total_amount']}, Status='{inv['status']}'")

    inv1_id = uploaded[0]["id"]
    inv2_id = uploaded[1]["id"]
    
    # Verify Invoice 2 is FLAGGED
    assert uploaded[1]["status"] == "FLAGGED", "Invoice 2 should be FLAGGED due to arithmetic mismatch"
    print(f"Validation engine correctly flagged Invoice #{inv2_id} with warnings: {uploaded[1]['validation_warnings']}")

    # 3. Human Review & Correction of Invoice 2
    print(f"\n[Step 3] Human reviewer correcting Invoice #{inv2_id}...")
    patch_payload = {
        "subtotal": 480.0,
        "tax_amount": 40.0,
        "total_amount": 520.0
    }
    r_patch = client.patch(f"/api/v1/invoices/{inv2_id}", json=patch_payload)
    assert r_patch.status_code == 200
    corrected = r_patch.json()
    assert corrected["is_corrected"] is True
    assert corrected["status"] == "PENDING_REVIEW"
    assert len(corrected["validation_warnings"]) == 0
    print(f"Invoice #{inv2_id} corrected. Arithmetic reconciled. Status updated to '{corrected['status']}'.")

    # 4. Approve Invoices 1 and 2
    print(f"\n[Step 4] Approving validated invoices...")
    for target_id, approver_note in [(inv1_id, "Approved by FinOps"), (inv2_id, "Corrected & approved by Senior Accountant")]:
        r_app = client.post(
            f"/api/v1/invoices/{target_id}/status",
            json={"status": "APPROVED", "notes": approver_note}
        )
        assert r_app.status_code == 200
        approved = r_app.json()
        assert approved["status"] == "APPROVED"
        assert approved["approved_at"] is not None
        print(f"Invoice #{target_id} approved at {approved['approved_at']}.")

    # 5. Check Dashboard Analytics
    print("\n[Step 5] Checking executive dashboard analytics...")
    r_dash = client.get("/api/v1/dashboard/summary")
    assert r_dash.status_code == 200
    dash = r_dash.json()
    print(f"  - Total Invoices: {dash['total_invoices_processed']}")
    print(f"  - Approved Expenses: ${dash['total_approved_expenses']}")
    print(f"  - Pending Review: {dash['pending_review_count']}")
    print(f"  - Flagged: {dash['flagged_count']}")
    print(f"  - Monthly Breakdown: {[m['month'] + ': $' + str(m['amount']) for m in dash['monthly_expenditure']]}")
    print(f"  - Vendor Breakdown: {[v['vendor_name'] + ': $' + str(v['amount']) for v in dash['vendor_expenditure']]}")
    
    assert dash["total_invoices_processed"] == 3
    # Approved expenses: $2750 + $520 = $3270
    assert dash["total_approved_expenses"] == 3270.0

    # 6. Generate and Download Excel Expense Report
    print("\n[Step 6] Generating and downloading Excel report...")
    r_report = client.get("/api/v1/reports/export?approved_only=true")
    assert r_report.status_code == 200
    excel_content = r_report.content
    assert len(excel_content) > 1000, "Excel report output too small"

    # Inspect Excel Workbook
    wb = openpyxl.load_workbook(io.BytesIO(excel_content))
    assert "Executive Summary" in wb.sheetnames
    assert "Detailed Invoices" in wb.sheetnames
    
    ws_summary = wb["Executive Summary"]
    title = ws_summary.cell(row=2, column=2).value
    print(f"Workbook Sheet 1 Title: '{title}'")
    
    ws_details = wb["Detailed Invoices"]
    headers = [cell.value for cell in ws_details[1]]
    print(f"Workbook Sheet 2 Columns: {headers}")
    row_count = ws_details.max_row
    print(f"Total rows in Detailed Invoices sheet: {row_count}")
    assert row_count >= 3 # Header + 2 approved invoices

    print("\n" + "=" * 70)
    print("SUCCESS: ALL END-TO-END BUSINESS AUTOMATION WORKFLOWS VERIFIED 100%!")
    print("=" * 70)

if __name__ == "__main__":
    run_verification()

