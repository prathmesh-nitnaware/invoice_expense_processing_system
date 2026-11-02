from typing import Optional
from pydantic import BaseModel

class ReportFilterParams(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    vendor_name: Optional[str] = None
    approved_only: bool = True

