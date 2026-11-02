import io
import logging
from pathlib import Path
from PIL import Image
import fitz
import pytesseract
from backend.app.config import settings

logger = logging.getLogger(__name__)

if settings.TESSERACT_CMD:
    pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD

def is_ocr_available() -> bool:
    """Checks if Tesseract binary is available on the host system."""
    try:
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False

def perform_ocr_on_pdf(file_path: str | Path, max_pages: int = 5) -> str:
    """
    Renders PDF pages to images and runs Tesseract OCR to extract text from scanned documents.
    """
    path = Path(file_path)
    if not path.exists():
        return ""

    if not is_ocr_available():
        logger.warning("Tesseract OCR is not installed or not in PATH. Skipping OCR rasterization.")
        return ""

    ocr_results = []
    try:
        doc = fitz.open(str(path))
        num_pages = min(len(doc), max_pages)
        
        for i in range(num_pages):
            page = doc[i]
            # Render at 200 DPI for reliable OCR accuracy
            pix = page.get_pixmap(dpi=200)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            page_text = pytesseract.image_to_string(img)
            if page_text.strip():
                ocr_results.append(page_text.strip())
                
        doc.close()
        return "\n\n--- OCR Page Break ---\n\n".join(ocr_results)
    except Exception as e:
        logger.error(f"OCR failed for {file_path}: {e}")
        return ""

