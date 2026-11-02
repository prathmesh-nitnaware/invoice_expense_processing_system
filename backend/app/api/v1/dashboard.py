from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from backend.app.api.deps import get_db
from backend.app.models.invoice import Invoice
from backend.app.schemas.dashboard import (
    DashboardSummaryResponse,
    MonthlyExpense,
    VendorExpense
)

router = APIRouter()

@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(db: Session = Depends(get_db)):
    """
    Computes key performance indicators, expenditure totals, monthly trends,
    and vendor breakdowns for the executive dashboard.
    """
    total_invoices_processed = db.query(Invoice).count()

    # Total approved expenses
    approved_total = db.query(func.sum(Invoice.total_amount)).filter(
        Invoice.status == "APPROVED"
    ).scalar() or 0.0

    # Total overall expenditure (all valid amounts recorded)
    total_expenditure = db.query(func.sum(Invoice.total_amount)).filter(
        Invoice.total_amount.isnot(None)
    ).scalar() or 0.0

    pending_count = db.query(Invoice).filter(Invoice.status == "PENDING_REVIEW").count()
    flagged_count = db.query(Invoice).filter(Invoice.status == "FLAGGED").count()

    # Monthly expenditure calculation based on invoice_date
    invoices_with_dates = db.query(Invoice.invoice_date, Invoice.total_amount).filter(
        Invoice.total_amount.isnot(None),
        Invoice.invoice_date.isnot(None)
    ).all()

    monthly_map: Dict[str, Dict[str, Any]] = {}
    for inv_date, amount in invoices_with_dates:
        # Standardize month prefix YYYY-MM
        month_key = inv_date[:7] if inv_date and len(inv_date) >= 7 else "Unknown"
        if month_key not in monthly_map:
            monthly_map[month_key] = {"amount": 0.0, "count": 0}
        monthly_map[month_key]["amount"] += (amount or 0.0)
        monthly_map[month_key]["count"] += 1

    monthly_expenditure = [
        MonthlyExpense(
            month=k,
            amount=round(v["amount"], 2),
            count=v["count"]
        )
        for k, v in sorted(monthly_map.items()) if k != "Unknown"
    ]

    # Vendor-wise expenditure
    vendor_stats = db.query(
        Invoice.vendor_name,
        func.count(Invoice.id).label("count"),
        func.sum(Invoice.total_amount).label("amount")
    ).filter(
        Invoice.vendor_name.isnot(None),
        Invoice.total_amount.isnot(None)
    ).group_by(Invoice.vendor_name).order_by(desc("amount")).limit(10).all()

    vendor_expenditure = []
    base_sum = total_expenditure if total_expenditure > 0 else 1.0
    for vname, vcount, vamt in vendor_stats:
        amount = vamt or 0.0
        pct = round((amount / base_sum) * 100, 1)
        vendor_expenditure.append(
            VendorExpense(
                vendor_name=vname,
                amount=round(amount, 2),
                count=vcount,
                percentage=pct
            )
        )

    # Recent 6 invoices
    recent = db.query(Invoice).order_by(desc(Invoice.created_at)).limit(6).all()
    recent_list = [
        {
            "id": inv.id,
            "vendor_name": inv.vendor_name or "Unknown",
            "invoice_number": inv.invoice_number or "N/A",
            "invoice_date": inv.invoice_date or "",
            "total_amount": inv.total_amount,
            "currency": inv.currency or "USD",
            "status": inv.status,
            "created_at": inv.created_at.isoformat()
        }
        for inv in recent
    ]

    return DashboardSummaryResponse(
        total_invoices_processed=total_invoices_processed,
        total_approved_expenses=round(approved_total, 2),
        pending_review_count=pending_count,
        flagged_count=flagged_count,
        total_expenditure=round(total_expenditure, 2),
        monthly_expenditure=monthly_expenditure,
        vendor_expenditure=vendor_expenditure,
        recent_invoices=recent_list
    )

