from fastapi import APIRouter
from backend.app.config import settings
from backend.app.services.ocr_service import is_ocr_available

router = APIRouter()

@router.get("")
def get_system_settings():
    """
    Returns current environment status and feature toggles.
    Never exposes raw API keys to the frontend.
    """
    has_gemini_key = bool(settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY) > 5)
    ocr_active = is_ocr_available()
    
    return {
        "project_name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "ai_engine": {
            "gemini_configured": has_gemini_key,
            "gemini_model": settings.GEMINI_MODEL,
            "demo_mode_active": settings.DEMO_MODE or not has_gemini_key,
            "status_label": "Gemini Live API" if has_gemini_key and not settings.DEMO_MODE else "Deterministic Demo Mode"
        },
        "ocr_engine": {
            "tesseract_available": ocr_active,
            "tesseract_path": settings.TESSERACT_CMD or "System default PATH",
            "status_label": "Tesseract OCR Active" if ocr_active else "OCR Fallback Offline (Standard PyMuPDF text active)"
        },
        "validation_rules": {
            "total_tolerance": settings.TOTAL_TOLERANCE,
            "max_upload_size_mb": settings.MAX_UPLOAD_SIZE_MB,
            "allowed_extensions": settings.ALLOWED_EXTENSIONS
        },
        "database": {
            "driver": "PostgreSQL" if "postgresql" in settings.DATABASE_URL else "SQLite (Local/Dev Fallback)"
        }
    }

