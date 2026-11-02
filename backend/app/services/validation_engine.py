import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.app.config import settings
from backend.app.models.invoice import Invoice
from backend.app.schemas.invoice import InvoiceExtractionSchema

logger = logging.getLogger(__name__)

def parse_date(date_str: Optional[str]) -> Optional[datetime]:
    if not date_str:
        return None
    # Try various standard formats
    formats = [
        "%Y-%m-%d", "%Y/%m/%d",
        "%d-%m-%Y", "%d/%m/%Y",
        "%m-%d-%Y", "%m/%d/%Y",
        "%B %d, %Y", "%b %d, %Y",
        "%d %B %Y", "%d %b %Y",
        "%Y.%m.%d", "%d.%m.%Y"
    ]
    cleaned = date_str.strip()
    for fmt in formats:
        try:
            return datetime.strptime(cleaned, fmt)
        except ValueError:
            continue
    return None

def validate_invoice_data(
    data: InvoiceExtractionSchema | Dict[str, Any],
    db: Optional[Session] = None,
    current_invoice_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Validates invoice fields against business rules.
    
    Returns:
        {
            "is_valid": bool,
            "status": "FLAGGED" | "PENDING_REVIEW",
            "warnings": List[str],
            "severity": "NORMAL" | "WARNING" | "CRITICAL"
        }
    """
    if isinstance(data, InvoiceExtractionSchema):
        d = data.model_dump()
    else:
        d = dict(data)

    warnings: List[str] = []

    vendor_name = (d.get("vendor_name") or "").strip()
    invoice_number = (d.get("invoice_number") or "").strip()
    invoice_date_str = d.get("invoice_date")
    due_date_str = d.get("due_date")
    subtotal = d.get("subtotal")
    tax_amount = d.get("tax_amount")
    tax_percentage = d.get("tax_percentage")
    total_amount = d.get("total_amount")

    # 1. Missing Required Fields
    if not vendor_name:
        warnings.append("Missing vendor name")
    if not invoice_number:
        warnings.append("Missing invoice number")
    if not invoice_date_str:
        warnings.append("Missing invoice date")
    if total_amount is None:
        warnings.append("Missing total invoice amount")

    # 2. Date Validation
    inv_date = parse_date(invoice_date_str) if invoice_date_str else None
    if invoice_date_str and not inv_date:
        warnings.append(f"Unrecognized or invalid invoice date format: '{invoice_date_str}'")

    if due_date_str:
        due_date = parse_date(due_date_str)
        if not due_date:
            warnings.append(f"Unrecognized or invalid due date format: '{due_date_str}'")
        elif inv_date and due_date < inv_date:
            warnings.append(f"Due date ({due_date.strftime('%Y-%m-%d')}) precedes invoice date ({inv_date.strftime('%Y-%m-%d')})")

    # 3. Arithmetic consistency & Suspicious Totals
    if total_amount is not None:
        if total_amount < 0:
            warnings.append(f"Suspicious negative total amount: {total_amount}")
        elif total_amount == 0:
            warnings.append("Total amount is zero")

    if subtotal is not None and tax_amount is not None and total_amount is not None:
        expected_total = subtotal + tax_amount
        diff = abs(expected_total - total_amount)
        if diff > settings.TOTAL_TOLERANCE:
            warnings.append(
                f"Total amount mismatch: Subtotal ({subtotal:.2f}) + Tax ({tax_amount:.2f}) = "
                f"{expected_total:.2f}, but total is {total_amount:.2f} (diff: {diff:.2f})"
            )

    if subtotal is not None and tax_percentage is not None and tax_amount is not None and subtotal > 0:
        expected_tax = subtotal * (tax_percentage / 100.0)
        tax_diff = abs(expected_tax - tax_amount)
        if tax_diff > (settings.TOTAL_TOLERANCE * 5):
            warnings.append(
                f"Tax calculation mismatch: {tax_percentage}% of {subtotal:.2f} is {expected_tax:.2f}, but tax is {tax_amount:.2f}"
            )

    # 4. Duplicate Invoice Check
    if db and vendor_name and invoice_number:
        query = db.query(Invoice).filter(
            Invoice.vendor_name.ilike(vendor_name),
            Invoice.invoice_number.ilike(invoice_number)
        )
        if current_invoice_id:
            query = query.filter(Invoice.id != current_invoice_id)
        
        duplicate = query.first()
        if duplicate:
            warnings.append(f"Duplicate invoice detected: Invoice #{invoice_number} from vendor '{vendor_name}' already exists (ID: {duplicate.id})")

    # Determine status: Any warning flags it for human review
    is_clean = len(warnings) == 0
    status = "FLAGGED" if not is_clean else "PENDING_REVIEW"

    return {
        "is_valid": is_clean,
        "status": status,
        "warnings": warnings
    }

