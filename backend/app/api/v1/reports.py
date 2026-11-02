from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db
from backend.app.schemas.report import ReportFilterParams
from backend.app.services.report_service import generate_excel_expense_report

router = APIRouter()

@router.get("/export")
def download_expense_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    vendor_name: Optional[str] = Query(None),
    approved_only: bool = Query(True),
    db: Session = Depends(get_db)
):
    """
    Generates and downloads a multi-sheet Excel (.xlsx) expense report with executive summary and detail sheets.
    """
    filters = ReportFilterParams(
        start_date=start_date,
        end_date=end_date,
        vendor_name=vendor_name,
        approved_only=approved_only
    )
    
    excel_bytes = generate_excel_expense_report(db=db, filters=filters)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"expense_report_{timestamp}.xlsx"

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )

