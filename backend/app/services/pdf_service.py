import logging
from pathlib import Path
from typing import Tuple, Dict, Any
import fitz  # PyMuPDF

logger = logging.getLogger(__name__)

class PDFProcessingError(Exception):
    pass

class PDFPasswordProtectedError(PDFProcessingError):
    pass

class PDFCorruptedError(PDFProcessingError):
    pass

class PDFEmptyError(PDFProcessingError):
    pass

def extract_text_from_pdf(file_path: str | Path) -> Tuple[str, bool, Dict[str, Any]]:
    """
    Extracts text and metadata from a PDF file using PyMuPDF.
    
    Returns:
        (text, is_scanned, metadata)
    Raises:
        PDFPasswordProtectedError: If the PDF is encrypted/requires a password.
        PDFCorruptedError: If the PDF is corrupted or invalid.
        PDFEmptyError: If the PDF has 0 pages or 0 bytes.
    """
    path = Path(file_path)
    if not path.exists():
        raise PDFCorruptedError(f"File not found: {file_path}")
        
    if path.stat().st_size == 0:
        raise PDFEmptyError("PDF file is empty (0 bytes)")

    try:
        doc = fitz.open(str(path))
    except Exception as e:
        logger.error(f"Failed to open PDF {file_path}: {e}")
        raise PDFCorruptedError(f"Corrupted or invalid PDF format: {str(e)}")

    try:
        if doc.is_encrypted:
            # Check if it can be authenticated with empty password
            if not doc.authenticate(""):
                raise PDFPasswordProtectedError("PDF is password protected and cannot be read without credentials")

        if len(doc) == 0:
            raise PDFEmptyError("PDF contains no pages")

        full_text = []
        total_chars = 0
        
        metadata = {
            "page_count": len(doc),
            "format": doc.metadata.get("format", ""),
            "title": doc.metadata.get("title", ""),
            "author": doc.metadata.get("author", ""),
        }

        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text("text") or ""
            full_text.append(text)
            total_chars += len(text.strip())

        combined_text = "\n".join(full_text).strip()
        
        # Scanned heuristic: If average characters per page is below 40, it is likely scanned/image-based
        avg_chars_per_page = total_chars / len(doc) if len(doc) > 0 else 0
        is_scanned = avg_chars_per_page < 40 or total_chars < 50
        
        return combined_text, is_scanned, metadata

    except (PDFPasswordProtectedError, PDFEmptyError, PDFCorruptedError):
        raise
    except Exception as e:
        logger.error(f"Unexpected error processing PDF {file_path}: {e}")
        raise PDFCorruptedError(f"Could not parse PDF content: {str(e)}")
    finally:
        doc.close()

