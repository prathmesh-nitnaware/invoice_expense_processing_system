from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.database import Base

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_hash = Column(String(64), unique=True, index=True, nullable=False)
    file_size = Column(Integer, nullable=False)
    
    # Status: PENDING_REVIEW, FLAGGED, APPROVED, REJECTED, FAILED
    status = Column(String(50), default="PENDING_REVIEW", index=True, nullable=False)
    ocr_applied = Column(Boolean, default=False)
    raw_text = Column(Text, nullable=True)
    ai_raw_response = Column(Text, nullable=True)
    
    # Extracted raw values snapshot (JSON format to preserve original AI output)
    extracted_data = Column(JSON, nullable=True)
    
    # Current active / verified values (may be user-corrected)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    vendor_name = Column(String(255), index=True, nullable=True)
    invoice_number = Column(String(100), index=True, nullable=True)
    invoice_date = Column(String(50), nullable=True)
    due_date = Column(String(50), nullable=True)
    customer_name = Column(String(255), nullable=True)
    subtotal = Column(Float, nullable=True)
    tax_amount = Column(Float, nullable=True)
    tax_percentage = Column(Float, nullable=True)
    total_amount = Column(Float, nullable=True)
    currency = Column(String(10), default="USD", nullable=True)
    payment_status = Column(String(50), nullable=True)
    
    # Correction tracking
    is_corrected = Column(Boolean, default=False)
    corrected_fields = Column(JSON, default=list, nullable=True) # list of field names edited by user
    
    # Validation & Confidence
    confidence_score = Column(Float, default=0.0) # 0.0 - 1.0
    validation_warnings = Column(JSON, default=list, nullable=True) # list of strings
    is_valid = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)

    # Relationships
    vendor = relationship("Vendor", back_populates="invoices")
    line_items = relationship("InvoiceLineItem", back_populates="invoice", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="invoice", cascade="all, delete-orphan")

class InvoiceLineItem(Base):
    __tablename__ = "invoice_line_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    description = Column(String(500), nullable=False)
    quantity = Column(Float, default=1.0)
    unit_price = Column(Float, default=0.0)
    total = Column(Float, default=0.0)

    invoice = relationship("Invoice", back_populates="line_items")

