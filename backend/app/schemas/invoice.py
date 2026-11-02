from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field

class LineItemSchema(BaseModel):
    description: str
    quantity: float = 1.0
    unit_price: float = 0.0
    total: float = 0.0

class InvoiceExtractionSchema(BaseModel):
    vendor_name: Optional[str] = Field(None, description="Name of the vendor/supplier")
    invoice_number: Optional[str] = Field(None, description="Unique invoice or bill identifier")
    invoice_date: Optional[str] = Field(None, description="Date of issuance (YYYY-MM-DD preferred)")
    due_date: Optional[str] = Field(None, description="Payment due date (YYYY-MM-DD preferred)")
    customer_name: Optional[str] = Field(None, description="Name of the customer, client, or billed entity")
    subtotal: Optional[float] = Field(None, description="Net amount before taxes")
    tax_amount: Optional[float] = Field(None, description="Tax or VAT amount")
    tax_percentage: Optional[float] = Field(None, description="Tax rate percentage if noted")
    total_amount: Optional[float] = Field(None, description="Grand total amount due")
    currency: Optional[str] = Field("USD", description="Currency code, e.g., USD, EUR, GBP")
    payment_status: Optional[str] = Field("PENDING", description="e.g. PAID, UNPAID, DUE, PENDING")
    line_items: List[LineItemSchema] = Field(default_factory=list)
    confidence_score: Optional[float] = Field(0.9, description="Estimated extraction confidence between 0.0 and 1.0")

class InvoiceUpdateSchema(BaseModel):
    vendor_name: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    customer_name: Optional[str] = None
    subtotal: Optional[float] = None
    tax_amount: Optional[float] = None
    tax_percentage: Optional[float] = None
    total_amount: Optional[float] = None
    currency: Optional[str] = None
    payment_status: Optional[str] = None

class InvoiceStatusUpdateSchema(BaseModel):
    status: str # APPROVED, REJECTED, PENDING_REVIEW, FLAGGED
    notes: Optional[str] = None

class AuditLogResponse(BaseModel):
    id: int
    action: str
    performed_by: str
    details: Optional[Any] = None
    timestamp: datetime

    class Config:
        from_attributes = True

class InvoiceResponse(BaseModel):
    id: int
    file_name: str
    file_path: Optional[str] = None
    file_hash: Optional[str] = None
    file_size: int
    status: str
    ocr_applied: bool
    raw_text: Optional[str] = None
    extracted_data: Optional[Any] = None
    
    # Active values
    vendor_id: Optional[int] = None
    vendor_name: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    customer_name: Optional[str] = None
    subtotal: Optional[float] = None
    tax_amount: Optional[float] = None
    tax_percentage: Optional[float] = None
    total_amount: Optional[float] = None
    currency: Optional[str] = None
    payment_status: Optional[str] = None
    
    # Validation & Correction
    is_corrected: bool = False
    corrected_fields: Optional[List[str]] = []
    confidence_score: float = 0.0
    validation_warnings: Optional[List[str]] = []
    is_valid: bool = True
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    processed_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    
    audit_logs: List[AuditLogResponse] = []

    class Config:
        from_attributes = True

class PaginatedInvoiceResponse(BaseModel):
    items: List[InvoiceResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
