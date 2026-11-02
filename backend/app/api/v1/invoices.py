import io
import math
import logging
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Query, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from backend.app.api.deps import get_db
from backend.app.models.invoice import Invoice
from backend.app.schemas.invoice import (
    InvoiceResponse,
    PaginatedInvoiceResponse,
    InvoiceUpdateSchema,
    InvoiceStatusUpdateSchema
)
from backend.app.services.invoice_service import (
    process_single_invoice_file,
    update_invoice_corrections,
    change_invoice_status,
    reprocess_existing_invoice
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/upload", response_model=List[InvoiceResponse])
def upload_invoices(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    """
    Accepts one or more invoice PDF uploads, extracts data, runs validation,
    and returns the created invoice records.
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files uploaded."
        )

    processed_invoices = []
    errors = []
    first_http_exception = None

    for file in files:
        try:
            content = file.file.read()
            invoice = process_single_invoice_file(file=file, file_bytes=content, db=db)
            processed_invoices.append(invoice)
        except HTTPException as e:
            if first_http_exception is None:
                first_http_exception = e
            errors.append(f"{file.filename}: {e.detail}")
        except Exception as e:
            logger.error(f"Error processing {file.filename}: {e}", exc_info=True)
            errors.append(f"{file.filename}: Unexpected error: {str(e)}")

    if not processed_invoices and errors:
        if len(files) == 1 and first_http_exception:
            raise first_http_exception
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="; ".join(errors)
        )

    return processed_invoices


@router.get("", response_model=PaginatedInvoiceResponse)
def list_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None,
    vendor_name: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    db: Session = Depends(get_db)
):
    """
    Lists invoices with filtering, searching, and pagination.
    """
    query = db.query(Invoice)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Invoice.vendor_name.ilike(s),
                Invoice.invoice_number.ilike(s),
                Invoice.file_name.ilike(s),
                Invoice.customer_name.ilike(s)
            )
        )

    if status and status.upper() != "ALL":
        query = query.filter(Invoice.status == status.upper())

    if vendor_name:
        query = query.filter(Invoice.vendor_name.ilike(f"%{vendor_name.strip()}%"))

    if start_date:
        query = query.filter(Invoice.invoice_date >= start_date)

    if end_date:
        query = query.filter(Invoice.invoice_date <= end_date)

    if min_amount is not None:
        query = query.filter(Invoice.total_amount >= min_amount)

    if max_amount is not None:
        query = query.filter(Invoice.total_amount <= max_amount)

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    items = query.order_by(desc(Invoice.created_at)).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    """
    Retrieves full details for a single invoice.
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.patch("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(
    invoice_id: int,
    updates: InvoiceUpdateSchema,
    db: Session = Depends(get_db)
):
    """
    Allows human correction of extracted invoice fields.
    """
    return update_invoice_corrections(invoice_id=invoice_id, updates=updates, db=db)


@router.post("/{invoice_id}/status", response_model=InvoiceResponse)
def update_status(
    invoice_id: int,
    payload: InvoiceStatusUpdateSchema,
    db: Session = Depends(get_db)
):
    """
    Approve, Reject, or modify the review status of an invoice.
    """
    return change_invoice_status(
        invoice_id=invoice_id,
        new_status=payload.status.upper(),
        notes=payload.notes,
        db=db
    )


@router.post("/{invoice_id}/reprocess", response_model=InvoiceResponse)
def reprocess_invoice(invoice_id: int, db: Session = Depends(get_db)):
    """
    Reprocesses an invoice through the OCR, AI, and validation pipeline.
    """
    return reprocess_existing_invoice(invoice_id=invoice_id, db=db)


@router.delete("/{invoice_id}")
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    """
    Deletes an invoice and cleans up associated file.
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    file_path = Path(invoice.file_path)
    if file_path.exists():
        try:
            file_path.unlink()
        except Exception as e:
            logger.warning(f"Could not remove file {file_path}: {e}")

    db.delete(invoice)
    db.commit()
    return {"message": f"Invoice {invoice_id} deleted successfully."}


@router.get("/{invoice_id}/file")
def get_invoice_pdf(invoice_id: int, db: Session = Depends(get_db)):
    """
    Streams the original uploaded PDF securely.
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    file_path = Path(invoice.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="PDF file not found on server")

    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=invoice.file_name
    )
