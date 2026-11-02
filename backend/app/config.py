import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI-Powered Invoice & Expense System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://postgres:postgres@localhost:5432/invoice_db"
    )
    
    # Gemini AI
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    DEMO_MODE: bool = os.getenv("DEMO_MODE", "false").lower() in ("true", "1", "yes") or not os.getenv("GEMINI_API_KEY")
    
    # Storage
    STORAGE_DIR: Path = BASE_DIR / "storage"
    UPLOAD_DIR: Path = BASE_DIR / "storage" / "invoices"
    REPORT_DIR: Path = BASE_DIR / "storage" / "reports"
    
    # Constraints & Validations
    MAX_UPLOAD_SIZE_MB: int = 15
    ALLOWED_EXTENSIONS: list[str] = [".pdf"]
    TOTAL_TOLERANCE: float = 0.05
    
    # OCR
    TESSERACT_CMD: str = os.getenv("TESSERACT_CMD", "")

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()

# Ensure directories exist
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.REPORT_DIR.mkdir(parents=True, exist_ok=True)

