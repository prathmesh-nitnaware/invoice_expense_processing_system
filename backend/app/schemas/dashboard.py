from typing import List, Dict, Any
from pydantic import BaseModel

class MonthlyExpense(BaseModel):
    month: str # e.g. "2026-01"
    amount: float
    count: int

class VendorExpense(BaseModel):
    vendor_name: str
    amount: float
    count: int
    percentage: float

class DashboardSummaryResponse(BaseModel):
    total_invoices_processed: int
    total_approved_expenses: float
    pending_review_count: int
    flagged_count: int
    total_expenditure: float
    currency: str = "USD"
    monthly_expenditure: List[MonthlyExpense]
    vendor_expenditure: List[VendorExpense]
    recent_invoices: List[Any]

