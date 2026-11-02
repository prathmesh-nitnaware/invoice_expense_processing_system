import json
import logging
import re
from typing import Tuple, Optional
from backend.app.config import settings
from backend.app.schemas.invoice import InvoiceExtractionSchema, LineItemSchema

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert financial document parser.
Your task is to analyze the text extracted from an invoice and extract structured financial fields into strict JSON format.

Extraction Rules:
1. Extract exactly what appears in the document.
2. If any field is not clearly present in the text, you MUST return null. NEVER guess, assume, or invent values.
3. Dates should be standardized to 'YYYY-MM-DD' format if possible, otherwise retain the documented text.
4. Numerical fields (subtotal, tax_amount, tax_percentage, total_amount) must be pure numbers (floats) without currency symbols or commas.
5. If line items are visible, list them. If not, return an empty array for line_items.
6. Provide an estimated confidence_score between 0.0 and 1.0 based on clarity and completeness of the document.

Respond with ONLY valid JSON with keys:
- vendor_name (string or null)
- invoice_number (string or null)
- invoice_date (string or null)
- due_date (string or null)
- customer_name (string or null)
- subtotal (number or null)
- tax_amount (number or null)
- tax_percentage (number or null)
- total_amount (number or null)
- currency (string or null, e.g. "USD", "EUR", "GBP")
- payment_status (string or null, e.g. "PAID", "UNPAID", "DUE", "PENDING")
- line_items (array of objects with {description, quantity, unit_price, total})
- confidence_score (number between 0.0 and 1.0)
"""

def extract_invoice_data_with_gemini(extracted_text: str) -> Tuple[InvoiceExtractionSchema, str, bool]:
    """
    Extracts structured invoice information using Gemini API.
    Falls back to a deterministic rule-based extractor if GEMINI_API_KEY is not configured.
    
    Returns:
        (InvoiceExtractionSchema, raw_response_text, is_demo_mode)
    """
    if not settings.GEMINI_API_KEY:
        logger.info("GEMINI_API_KEY not configured. Using deterministic rule-based Demo Mode extraction.")
        return extract_invoice_data_demo_mode(extracted_text)

    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(
            model_name=settings.GEMINI_MODEL,
            system_instruction=SYSTEM_PROMPT,
            generation_config={"response_mime_type": "application/json"}
        )
        
        prompt = f"Invoice Document Text:\n---\n{extracted_text}\n---"
        response = model.generate_content(prompt)
        raw_text = response.text.strip()
        
        # Clean markdown codeblocks if present
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
        raw_text = raw_text.strip()
        
        parsed_json = json.loads(raw_text)
        validated = InvoiceExtractionSchema.model_validate(parsed_json)
        return validated, raw_text, False

    except Exception as e:
        logger.error(f"Gemini API extraction failed: {e}. Falling back to demo extractor.")
        return extract_invoice_data_demo_mode(extracted_text, failure_reason=str(e))


def extract_invoice_data_demo_mode(text: str, failure_reason: Optional[str] = None) -> Tuple[InvoiceExtractionSchema, str, bool]:
    """
    Deterministic rule-based extractor used when Gemini API is unavailable or in offline demo mode.
    Explicitly labeled as DEMO_MODE so mock extraction is never disguised as real AI.
    """
    # Deterministic extraction using regex heuristics
    vendor_match = re.search(r"(?:Vendor|From|Company|Billed By):\s*([^\n\r]+)", text, re.IGNORECASE)
    if not vendor_match:
        # Check first non-empty line
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        vendor_name = lines[0] if lines and len(lines[0]) < 60 and not lines[0].lower().startswith("invoice") else None
    else:
        vendor_name = vendor_match.group(1).strip()

    inv_match = re.search(r"\bInvoice\s*(?:Number|Num\b\.?|No\b\.?|#|ID)\s*[:\s]*([A-Z0-9-_/]+)", text, re.IGNORECASE)
    if not inv_match:
        # Avoid matching 'Invoice Date' as an invoice number
        alt_match = re.search(r"\bInvoice\s*[:]\s*(?!Date\b)([A-Z0-9-_/]+)", text, re.IGNORECASE)
        invoice_number = alt_match.group(1).strip() if alt_match else None
    else:
        invoice_number = inv_match.group(1).strip()

    date_match = re.search(r"(?:Invoice\s*)?Date[:\s]*([0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}|[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})", text, re.IGNORECASE)
    invoice_date = date_match.group(1).strip() if date_match else None

    due_match = re.search(r"Due\s*Date[:\s]*([0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}|[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})", text, re.IGNORECASE)
    due_date = due_match.group(1).strip() if due_match else None

    cust_match = re.search(r"(?:Bill\s*To|Customer|Client)[:\s]*([^\n\r]+)", text, re.IGNORECASE)
    customer_name = cust_match.group(1).strip() if cust_match else None

    # Amount extraction
    subtotal_match = re.search(r"Subtotal[:\s]*[$€£]?\s*([0-9]+(?:\.[0-9]{2})?)", text, re.IGNORECASE)
    subtotal = float(subtotal_match.group(1)) if subtotal_match else None

    tax_match = re.search(r"Tax(?:\s*\([0-9]+%\))?[:\s]*[$€£]?\s*([0-9]+(?:\.[0-9]{2})?)", text, re.IGNORECASE)
    tax_amount = float(tax_match.group(1)) if tax_match else None

    tax_rate_match = re.search(r"Tax\s*\(?([0-9]+(?:\.[0-9]+)?)%\)?", text, re.IGNORECASE)
    tax_percentage = float(tax_rate_match.group(1)) if tax_rate_match else None

    # Total amount (exclude 'Subtotal')
    total_match = re.search(r"(?<!Sub)\b(?:Grand\s*)?Total(?: Amount)?[:\s]*[$€£]?\s*([0-9]+(?:\.[0-9]{2})?)", text, re.IGNORECASE)
    total_amount = float(total_match.group(1)) if total_match else None

    currency = "USD"
    if "€" in text or "EUR" in text:
        currency = "EUR"
    elif "£" in text or "GBP" in text:
        currency = "GBP"

    # Status
    status = "PENDING"
    if re.search(r"\bPAID\b", text, re.IGNORECASE):
        status = "PAID"
    elif re.search(r"\bOVERDUE\b", text, re.IGNORECASE):
        status = "OVERDUE"

    extraction = InvoiceExtractionSchema(
        vendor_name=vendor_name,
        invoice_number=invoice_number,
        invoice_date=invoice_date,
        due_date=due_date,
        customer_name=customer_name,
        subtotal=subtotal,
        tax_amount=tax_amount,
        tax_percentage=tax_percentage,
        total_amount=total_amount,
        currency=currency,
        payment_status=status,
        confidence_score=0.75 if (vendor_name and invoice_number and total_amount) else 0.40,
        line_items=[]
    )

    metadata = {
        "mode": "DEMO_RULE_BASED",
        "notice": "Generated via deterministic parser (Gemini API key not configured or fallback triggered)",
        "failure_reason": failure_reason,
        "raw_parsed": extraction.model_dump()
    }
    
    return extraction, json.dumps(metadata, indent=2), True
