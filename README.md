# AI-Powered Invoice and Expense Processing System

A production-grade business automation application built for small businesses, accounting firms, and agencies. The system automates end-to-end invoice processing: uploading invoice PDFs, extracting key financial data using Gemini API with PyMuPDF and Tesseract OCR fallback, validating data against arithmetic and duplicate rules, providing human review and correction workflows, and generating executive Excel expense reports.

---

## 1. Key Features

- **Multi-File PDF Ingestion**:
  - Drag-and-drop support for single or batch PDF uploads.
  - Automatic validation of file extensions and file size limits (default 15MB).
  - Pre-flight checks for corrupted, empty (0 bytes / 0 pages), and password-protected PDFs.
  - SHA-256 content hashing to detect and block accidental duplicate uploads.

- **Intelligent Financial Extraction Pipeline**:
  - **PyMuPDF (`fitz`)**: Fast digital text and metadata extraction.
  - **Tesseract OCR Fallback**: Automatically rasterizes pages and runs OCR when digital text is sparse or document is scanned.
  - **Gemini API Integration**: Uses strict structured JSON prompt and Pydantic schemas to extract:
    - Vendor Name
    - Invoice Number
    - Invoice Date & Due Date
    - Customer / Billed Entity
    - Subtotal, Tax Amount, Tax Rate %
    - Total Invoice Amount
    - Currency & Payment Status
    - Line Items & Confidence Score
  - **Deterministic Demo Mode**: Seamless fallback parser if `GEMINI_API_KEY` is not set, explicitly labeled so demo data is never disguised as real AI.
  - **Data Integrity**: Original extracted text is preserved; user corrections are tracked with field-level diffs and audit logs.

- **Automated Validation Rules Engine**:
  - Required fields check (Vendor Name, Invoice Number, Invoice Date, Total Amount).
  - Date format parsing and Chronological sanity check (Due Date must not precede Invoice Date).
  - Arithmetic consistency verification: Subtotal + Tax = Total within configurable tolerance (`±$0.05`).
  - Cross-invoice duplicate detection for matching Vendor + Invoice Number.
  - Non-destructive flagging: Invoices with issues are marked `FLAGGED` for human review rather than prematurely rejected.

- **Human-in-the-Loop Review & Approval Interface**:
  - Interactive split review screen: view original document text alongside editable form fields.
  - Visual badges indicating AI extraction confidence and human-modified fields.
  - Real-time recalculation of validation rules upon saving field corrections.
  - One-click Approve, Reject, or Reprocess actions with audit notes.

- **Executive Analytics Dashboard**:
  - Real-time KPI summary cards: Total Invoices Processed, Total Approved Expenses, Pending Review, Flagged.
  - Monthly expenditure volume and expenditure distribution trends.
  - Top vendor concentration analysis with percentage progress bars.
  - Recent invoices register with fast navigation to Review or Audit Details.

- **Multi-Sheet Excel Expense Reporting**:
  - Export formatted `.xlsx` workbooks using `pandas` and `openpyxl`.
  - Configurable filters: Date Range (From/To), Vendor Name, and "Approved Only" toggle.
  - **Sheet 1 (Executive Summary)**: KPI metrics, filter boundaries, and vendor expense share table.
  - **Sheet 2 (Detailed Invoices)**: Complete audit register with currency cell formatting and color-coded status pills.

---

## 2. Technology Stack

- **Frontend**: React 18, Vite, JavaScript, Tailwind CSS, Lucide Icons
- **Backend**: Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.0, Uvicorn
- **Database**: PostgreSQL 16 (with SQLite auto-fallback for zero-dependency local dev/testing)
- **Document & AI Processing**:
  - Google Gemini API (`google-generativeai`)
  - PyMuPDF (`fitz`) v2.0
  - Tesseract OCR (`pytesseract`) + Pillow
  - Pandas & OpenPyXL
- **Infrastructure**: Docker, Docker Compose, Nginx

---

## 3. Architecture Overview

```
                        ┌──────────────────────────────────────────────┐
                        │        React + Vite Frontend (Port 3000)     │
                        │  Dashboard | Upload | Review | Reports       │
                        └──────────────────────┬───────────────────────┘
                                               │ HTTP / REST API
                                               ▼
                        ┌──────────────────────────────────────────────┐
                        │         FastAPI Backend (Port 8000)          │
                        ├──────────────────────────────────────────────┤
                        │  - Security: Extension, Size & Hash check    │
                        │  - Extraction Pipeline:                      │
                        │      1. PyMuPDF (Digital Text)               │
                        │      2. Tesseract OCR (Scanned raster fallback)
                        │      3. Gemini API / Deterministic Parser    │
                        │      4. Pydantic Schema Validation           │
                        │  - Validation Engine:                        │
                        │      - Math consistency (Subtotal+Tax=Total) │
                        │      - Date validation & Duplicates check    │
                        │  - Reporting Service: Pandas + OpenPyXL      │
                        └──────────────┬────────────────────────┬──────┘
                                       │                        │
                      SQLAlchemy 2.0   │                        │ File Storage
                                       ▼                        ▼
                        ┌────────────────────────┐   ┌─────────────────┐
                        │ PostgreSQL Database    │   │ /storage        │
                        │ Invoices, Vendors,     │   │ - invoices/     │
                        │ Line Items, Audit Logs │   │ - reports/      │
                        └────────────────────────┘   └─────────────────┘
```

---

## 4. Quickstart with Docker Compose

### Prerequisites
- Docker Engine 20+ and Docker Compose

### 1. Clone & Set Environment
```bash
git clone <repository_url>
cd demo
cp .env.example .env
```

*(Optional)* Set your Google Gemini API key in `.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```
> If no API key is set, the application runs automatically in **Deterministic Demo Mode** with realistic rule-based parsing.

### 2. Run the Application
```bash
docker compose up --build
```

### 3. Access Services
- **Web Application**: [http://localhost:3000](http://localhost:3000)
- **API Documentation (Swagger UI)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **API Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

## 5. Local Development Setup (Without Docker)

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Backend Setup
```bash
# Create and activate virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Start backend server (defaults to local SQLite if PostgreSQL is not active)
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend Setup
In a separate terminal window:
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 6. Environment Variables Reference

| Variable | Default Value | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/invoice_db` | Relational database connection string. (Falls back to SQLite if unreachable). |
| `GEMINI_API_KEY` | `""` | Google Gemini API key. If omitted, demo mode is used. |
| `GEMINI_MODEL` | `gemini-1.5-flash` | Gemini model name for extraction. |
| `DEMO_MODE` | `false` | When `true`, activates deterministic rule-based extractor. |
| `MAX_UPLOAD_SIZE_MB`| `15` | Maximum upload size allowed per PDF invoice. |
| `TOTAL_TOLERANCE` | `0.05` | Allowed difference between Subtotal + Tax and Total. |
| `TESSERACT_CMD` | `""` | Custom path to `tesseract` binary (if not in system PATH). |

---

## 7. API Reference

### Invoices API (`/api/v1/invoices`)

- `POST /upload`  
  Uploads single or multiple PDF invoices. Extracts data, runs validation rules, and saves records.  
  *Payload*: `multipart/form-data` with `files` field.

- `GET /`  
  Lists invoices with pagination and filters.  
  *Query Parameters*: `page`, `page_size`, `search`, `status`, `vendor_name`, `start_date`, `end_date`, `min_amount`, `max_amount`.

- `GET /{id}`  
  Returns full invoice record, line items, and audit history.

- `PATCH /{id}`  
  Applies human corrections to fields (`vendor_name`, `invoice_number`, `invoice_date`, `subtotal`, `tax_amount`, `total_amount`, etc.). Automatically re-runs validation.

- `POST /{id}/status`  
  Updates review status (`APPROVED`, `REJECTED`, `FLAGGED`, `PENDING_REVIEW`) with audit notes.

- `POST /{id}/reprocess`  
  Re-runs OCR, AI extraction, and validation pipeline on the stored PDF file.

- `DELETE /{id}`  
  Deletes invoice, audit history, and associated file.

- `GET /{id}/file`  
  Streams original uploaded PDF securely.

### Dashboard API (`/api/v1/dashboard`)

- `GET /summary`  
  Returns aggregate financial KPIs, monthly expenditure volume, top vendor distributions, and recent invoices.

### Reports API (`/api/v1/reports`)

- `GET /export`  
  Generates and streams a downloadable multi-sheet Excel file (`.xlsx`).  
  *Query Parameters*: `start_date`, `end_date`, `vendor_name`, `approved_only` (default true).

### Settings API (`/api/v1/settings`)

- `GET /`  
  Returns configuration health, AI extraction engine status, OCR status, and tolerance parameters without exposing API credentials.

---

## 8. Automated Test Suite

The project includes an automated test suite executed with `pytest` covering all 12 core scenarios:

1. Valid text-based invoice PDF extraction.
2. Scanned invoice PDF detection and OCR fallback.
3. Invalid and corrupted PDF handling.
4. Empty PDF handling (0 bytes / 0 pages).
5. Missing invoice number validation and human-review flagging.
6. Incorrect total amount calculation and discrepancy warning.
7. Accidental duplicate upload prevention (SHA-256 hash detection).
8. External Gemini AI extraction failure resilience and fallback.
9. Database connection resilience.
10. Multi-sheet Excel expense report generation.
11. Invoice correction and approval workflow.
12. Multi-field search and query filtering.

### Running Backend Tests
```bash
# Windows Powershell:
$env:PYTHONPATH="."; .\venv\Scripts\python -m pytest backend/tests/ -v

# Linux/macOS:
PYTHONPATH=. pytest backend/tests/ -v
```

### Running End-to-End Workflow Verification
```bash
python verify_end_to_end.py
```

### Testing Frontend Build
```bash
cd frontend
npm run build
```

---

## 9. License

MIT License. Designed and architected for enterprise business automation.

