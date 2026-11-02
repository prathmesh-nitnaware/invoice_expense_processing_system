from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    action = Column(String(50), nullable=False) # e.g. UPLOADED, EXTRACTED, VALIDATED, EDITED, APPROVED, REJECTED, REPROCESSED
    performed_by = Column(String(100), default="System", nullable=False)
    details = Column(JSON, nullable=True) # details, diff of edits, or reason
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    invoice = relationship("Invoice", back_populates="audit_logs")

