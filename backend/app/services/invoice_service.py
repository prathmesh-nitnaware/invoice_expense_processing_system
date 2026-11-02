import hashlib
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.config import settings
from backend.app.models.invoice import Invoice, InvoiceLineItem
from backend.app.models.vendor import Vendor
from backend.app.models.audit import AuditLog
from backend.app.schemas.invoice import InvoiceUpdateSchema, LineItemSchema
from backend.app.services.pdf_service import (
    extract_text_from_pdf,
    PDFProcessingError,
    PDFPasswordProtectedError,
    PDFCorruptedError,
    PDFEmptyError,
)
from backend.app.services.ocr_service import perform_ocr_on_pdf
from backend.app.services.gemini_service import extract_invoice_data_with_gemini
from backend.app.services.validation_engine import validate_invoice_data

logger = logging.getLogger(__name__)

def compute_sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()

def get_or_create_vendor(db: Session, vendor_name: Optional[str]) -> Optional[Vendor]:
    if not vendor_name or not vendor_name.strip():
        return None
    name = vendor_name.strip()
    vendor = db.query(Vendor).filter(Vendor.name.ilike(name)).first()
    if not vendor:
        vendor = Vendor(name=name)
        db.add(vendor)
        db.flush()
    return vendor

def process_single_invoice_file(
    file: UploadFile,
    file_bytes: bytes,
    db: Session
) -> Invoice:
    """
    Validates, extracts, validates, and stores an uploaded invoice PDF.
    """
    # 1. Validation of extension and size
    filename = Path(file.filename or "invoice.pdf").name
    ext = Path(filename).suffix.lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Only PDF files are supported."
        )

    file_size = len(file_bytes)
    max_size_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if file_size > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB}MB."
        )

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded PDF file is empty (0 bytes)."
        )

    # 2. Check for duplicate upload via SHA-256 hash
    file_hash = compute_sha256(file_bytes)
    existing_by_hash = db.query(Invoice).filter(Invoice.file_hash == file_hash).first()
    if existing_by_hash:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Accidental duplicate upload detected: '{filename}' has already been processed (Invoice ID: {existing_by_hash.id})."
        )

    # 3. Save file securely with hash-based name to avoid collisions and path traversal
    safe_filename = f"{file_hash[:16]}_{filename}"
    saved_path = settings.UPLOAD_DIR / safe_filename
    with open(saved_path, "wb") as f:
        f.write(file_bytes)

    def safe_unlink(p: Path):
        try:
            if p.exists():
                p.unlink(missing_ok=True)
        except Exception as err:
            logger.debug(f"Could not immediately unlink {p}: {err}")

    # 4. Text Extraction with PyMuPDF
    try:
        raw_text, is_scanned, meta = extract_text_from_pdf(saved_path)
    except PDFPasswordProtectedError:
        safe_unlink(saved_path)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="PDF is password-protected and cannot be read."
        )
    except PDFEmptyError:
        safe_unlink(saved_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PDF contains no readable pages."
        )
    except (PDFCorruptedError, PDFProcessingError) as e:
        safe_unlink(saved_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Corrupted or unreadable PDF: {str(e)}"
        )

    # 5. Fallback to OCR if scanned
    ocr_applied = False
    if is_scanned:
        logger.info(f"Document {filename} identified as scanned. Initiating Tesseract OCR rasterization.")
        ocr_text = perform_ocr_on_pdf(saved_path)
        if ocr_text:
            raw_text = (raw_text + "\n\n" + ocr_text).strip()
            ocr_applied = True

    # 6. AI Extraction with Gemini (or Demo Mode Fallback)
    extracted_data, raw_ai_response, is_demo = extract_invoice_data_with_gemini(raw_text)

    # 7. Validation Rules Engine
    val_result = validate_invoice_data(extracted_data, db=db)

    # 8. Vendor Association
    vendor = get_or_create_vendor(db, extracted_data.vendor_name)

    # 9. Create Invoice Record
    invoice = Invoice(
        file_name=filename,
        file_path=str(saved_path),
        file_hash=file_hash,
        file_size=file_size,
        status=val_result["status"], # PENDING_REVIEW or FLAGGED
        ocr_applied=ocr_applied,
        raw_text=raw_text,
        ai_raw_response=raw_ai_response,
        extracted_data=extracted_data.model_dump(),
        vendor_id=vendor.id if vendor else None,
        vendor_name=extracted_data.vendor_name,
        invoice_number=extracted_data.invoice_number,
        invoice_date=extracted_data.invoice_date,
        due_date=extracted_data.due_date,
        customer_name=extracted_data.customer_name,
        subtotal=extracted_data.subtotal,
        tax_amount=extracted_data.tax_amount,
        tax_percentage=extracted_data.tax_percentage,
        total_amount=extracted_data.total_amount,
        currency=extracted_data.currency or "USD",
        payment_status=extracted_data.payment_status or "PENDING",
        is_corrected=False,
        corrected_fields=[],
        confidence_score=extracted_data.confidence_score or 0.7,
        validation_warnings=val_result["warnings"],
        is_valid=val_result["is_valid"],
        processed_at=datetime.utcnow()
    )
    db.add(invoice)
    db.flush()

    # Add Line items if extracted
    if extracted_data.line_items:
        for item in extracted_data.line_items:
            li = InvoiceLineItem(
                invoice_id=invoice.id,
                description=item.description,
                quantity=item.quantity,
                unit_price=item.unit_price,
                total=item.total
            )
            db.add(li)

    # Create Initial Audit Logs
    audit_upload = AuditLog(
        invoice_id=invoice.id,
        action="UPLOADED",
        performed_by="User",
        details={"file_name": filename, "file_size": file_size}
    )
    audit_extract = AuditLog(
        invoice_id=invoice.id,
        action="EXTRACTED",
        performed_by="Gemini AI" if not is_demo else "Demo Parser",
        details={
            "ocr_applied": ocr_applied,
            "confidence": extracted_data.confidence_score,
            "demo_mode": is_demo
        }
    )
    audit_validate = AuditLog(
        invoice_id=invoice.id,
        action="VALIDATED",
        performed_by="Validation Engine",
        details={"warnings": val_result["warnings"], "status": val_result["status"]}
    )
    db.add_all([audit_upload, audit_extract, audit_validate])
    db.commit()
    db.refresh(invoice)

    return invoice

def update_invoice_corrections(
    invoice_id: int,
    updates: InvoiceUpdateSchema,
    db: Session
) -> Invoice:
    """
    Applies human corrections to invoice active fields, preserving original extracted values.
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    update_dict = updates.model_dump(exclude_unset=True)
    if not update_dict:
        return invoice

    diffs = {}
    changed_fields = list(invoice.corrected_fields or [])

    for field, new_val in update_dict.items():
        old_val = getattr(invoice, field)
        if old_val != new_val:
            diffs[field] = {"old": old_val, "new": new_val}
            setattr(invoice, field, new_val)
            if field not in changed_fields:
                changed_fields.append(field)

    if diffs:
        invoice.is_corrected = True
        invoice.corrected_fields = changed_fields

        # Update vendor if vendor_name was changed
        if "vendor_name" in diffs:
            vendor = get_or_create_vendor(db, invoice.vendor_name)
            invoice.vendor_id = vendor.id if vendor else None

        # Re-run validation with updated fields
        val_result = validate_invoice_data(invoice.__dict__, db=db, current_invoice_id=invoice.id)
        invoice.validation_warnings = val_result["warnings"]
        invoice.is_valid = val_result["is_valid"]
        # If it was FLAGGED and now is valid, update to PENDING_REVIEW
        if invoice.status == "FLAGGED" and val_result["is_valid"]:
            invoice.status = "PENDING_REVIEW"
        elif not val_result["is_valid"] and invoice.status != "APPROVED":
            invoice.status = "FLAGGED"

        # Record audit log
        audit = AuditLog(
            invoice_id=invoice.id,
            action="EDITED",
            performed_by="User",
            details=diffs
        )
        db.add(audit)
        db.commit()
        db.refresh(invoice)

    return invoice

def change_invoice_status(
    invoice_id: int,
    new_status: str,
    notes: Optional[str],
    db: Session
) -> Invoice:
    """
    Approves, Rejects, or updates invoice status.
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    valid_statuses = ["PENDING_REVIEW", "FLAGGED", "APPROVED", "REJECTED"]
    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{new_status}'. Allowed: {valid_statuses}"
        )

    old_status = invoice.status
    invoice.status = new_status

    if new_status == "APPROVED":
        invoice.approved_at = datetime.utcnow()
    else:
        invoice.approved_at = None

    audit = AuditLog(
        invoice_id=invoice.id,
        action=f"STATUS_CHANGE_{new_status}",
        performed_by="User",
        details={"from": old_status, "to": new_status, "notes": notes}
    )
    db.add(audit)
    db.commit()
    db.refresh(invoice)
    return invoice

def reprocess_existing_invoice(invoice_id: int, db: Session) -> Invoice:
    """
    Reprocesses an existing invoice document through OCR, AI, and Validation.
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    file_path = Path(invoice.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=400, detail="Original document file not found on server")

    raw_text, is_scanned, meta = extract_text_from_pdf(file_path)
    ocr_applied = False
    if is_scanned:
        ocr_text = perform_ocr_on_pdf(file_path)
        if ocr_text:
            raw_text = (raw_text + "\n\n" + ocr_text).strip()
            ocr_applied = True

    extracted_data, raw_ai_response, is_demo = extract_invoice_data_with_gemini(raw_text)
    val_result = validate_invoice_data(extracted_data, db=db, current_invoice_id=invoice.id)
    vendor = get_or_create_vendor(db, extracted_data.vendor_name)

    # Update invoice fields
    invoice.raw_text = raw_text
    invoice.ocr_applied = ocr_applied
    invoice.ai_raw_response = raw_ai_response
    invoice.extracted_data = extracted_data.model_dump()
    invoice.vendor_id = vendor.id if vendor else None
    invoice.vendor_name = extracted_data.vendor_name
    invoice.invoice_number = extracted_data.invoice_number
    invoice.invoice_date = extracted_data.invoice_date
    invoice.due_date = extracted_data.due_date
    invoice.customer_name = extracted_data.customer_name
    invoice.subtotal = extracted_data.subtotal
    invoice.tax_amount = extracted_data.tax_amount
    invoice.tax_percentage = extracted_data.tax_percentage
    invoice.total_amount = extracted_data.total_amount
    invoice.currency = extracted_data.currency or "USD"
    invoice.payment_status = extracted_data.payment_status or "PENDING"
    invoice.status = val_result["status"]
    invoice.confidence_score = extracted_data.confidence_score or 0.7
    invoice.validation_warnings = val_result["warnings"]
    invoice.is_valid = val_result["is_valid"]
    invoice.processed_at = datetime.utcnow()
    invoice.is_corrected = False
    invoice.corrected_fields = []

    audit = AuditLog(
        invoice_id=invoice.id,
        action="REPROCESSED",
        performed_by="User",
        details={"status": invoice.status, "ocr_applied": ocr_applied}
    )
    db.add(audit)
    db.commit()
    db.refresh(invoice)
    return invoice
