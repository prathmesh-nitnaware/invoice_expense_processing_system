import io
import os

# Set DATABASE_URL for tests before any backend modules are imported
os.environ["DATABASE_URL"] = "sqlite:///./test_invoice.db"
os.environ["DEMO_MODE"] = "true"

import pytest
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import fitz # PyMuPDF
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.config import settings
from backend.app.database import Base, get_db
from backend.app.main import app

# Use isolated sqlite db for testing
TEST_DB_URL = "sqlite:///./test_invoice.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture
def db_session():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture
def client():
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()
            
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

def generate_pdf_with_text(text_lines: list[str]) -> bytes:
    """Creates a valid PDF with text."""
    doc = fitz.open()
    page = doc.new_page(width=595, height=842) # A4
    y = 50
    for line in text_lines:
        page.insert_text((50, y), line, fontsize=12)
        y += 25
    pdf_bytes = doc.write()
    doc.close()
    return pdf_bytes

def generate_scanned_pdf(text_lines: list[str]) -> bytes:
    """Creates a PDF where text is drawn on an image so there is no digital text stream."""
    img = Image.new("RGB", (600, 800), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    y = 40
    for line in text_lines:
        draw.text((40, y), line, fill=(0, 0, 0))
        y += 30
    
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_bytes = img_byte_arr.getvalue()

    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    rect = fitz.Rect(0, 0, 595, 842)
    page.insert_image(rect, stream=img_bytes)
    pdf_bytes = doc.write()
    doc.close()
    return pdf_bytes
