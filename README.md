# AI-Powered Invoice & Expense Processing System

A production-grade business automation and DevOps-enabled financial processing platform built for small businesses, accounting firms, and agencies. The system automates end-to-end invoice processing: PDF ingestion, hybrid OCR and Gemini AI extraction, financial validation, human review workflows, and multi-sheet Excel reporting, backed by a comprehensive enterprise DevOps toolchain (Jenkins, SonarQube, Trivy, Docker, Prometheus, Grafana, and Nginx).

---

## 1. System Architecture

```
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │                              Client Browser / API Consumers                            │
 └───────────────────────────────────────────┬────────────────────────────────────────────┘
                                             │ HTTP / HTTPS (Port 80 / 3000)
                                             ▼
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │                                Nginx Reverse Proxy (Port 80)                           │
 │     - Client Max Body: 25M (PDFs)   - Gzip Compression   - Correlation ID Tracking     │
 └─────────────────────┬───────────────────────────────────────────────────┬──────────────┘
                       │ / (Frontend UI)                                   │ /api/, /metrics
                       ▼                                                   ▼
 ┌──────────────────────────────────────────────┐        ┌────────────────────────────────┐
 │        React 18 + Vite (Port 80)             │        │    FastAPI Backend (Port 8000) │
 │  - Dashboard & Analytics                     │        │  - PDF Pipeline (PyMuPDF)      │
 │  - Upload Zone with Hash Duplicate Check     │        │  - OCR Rasterizer (Tesseract)  │
 │  - Side-by-Side Review & Corrections         │        │  - Gemini Structured AI        │
 │  - Excel Expense Reports Generator           │        │  - Validation Rules Engine     │
 │  - System Status & Configuration             │        │  - Prometheus /metrics Exposer │
 └──────────────────────────────────────────────┘        └──────────────┬─────────────────┘
                                                                        │ SQLAlchemy 2.0
                                                                        ▼
 ┌──────────────────────────────────────────────┐        ┌────────────────────────────────┐
 │               Persistent Storage             │        │     PostgreSQL 16 Database     │
 │  - /storage/invoices (Secure PDF store)      │        │  - Invoices & Line Items       │
 │  - /storage/reports  (Generated Workbooks)   │        │  - Vendors & Audit Logs        │
 └──────────────────────────────────────────────┘        └────────────────────────────────┘

 ================================= DEVOPS TOOLCHAIN ========================================
 ┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐  ┌───────┐
 │ Jenkins CI/CD (8080)  │  │ SonarQube QG (9000)   │  │ Prometheus (9090)     │  │Grafana│
 │ 15-Stage Pipeline     │  │ Code Quality Analysis │  │ Metric Scraper        │  │(3001) │
 └───────────────────────┘  └───────────────────────┘  └───────────────────────┘  └───────┘
```

---

## 2. Technology Stack

### Application Layer
- **Frontend**: React 18, Vite, JavaScript, Tailwind CSS, Lucide Icons.
- **Backend**: Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.0, Uvicorn.
- **Database**: PostgreSQL 16 Alpine (with automatic zero-config SQLite fallback for local test execution).
- **Document & AI Processing**:
  - `PyMuPDF` (`fitz`) v2.0 for native digital text extraction.
  - `Tesseract OCR` (`pytesseract` + Pillow) for scanned image-based invoices.
  - `Google Gemini API` (`google-generativeai`) with structured JSON schema enforcement.
  - *Deterministic Demo Mode*: Seamless automatic fallback if `GEMINI_API_KEY` is not provided.
  - `pandas` & `openpyxl` for multi-sheet Excel reports.

### DevOps & Infrastructure Toolchain
- **CI/CD Orchestration**: Jenkins (Declarative Pipeline with 15 stages), GitHub Actions (PR Validation).
- **Containerization**: Docker, Multi-Stage Hardened Dockerfiles, Non-Root Users (`appuser:10001`).
- **Orchestration**: Docker Compose with profiles for Core App, Local Development, and DevOps Stack.
- **Code Quality & Static Analysis**: SonarQube with coverage reporting via `pytest-cov`.
- **Security Scanning**: Trivy (Filesystem, CVE Dependency, and Container Image scanning).
- **Observability & Monitoring**: Prometheus (`/metrics` scraping), Grafana (Pre-provisioned dashboards), Structured Logging with `X-Correlation-ID`.
- **Reverse Proxy**: Nginx with rate/size limits (`25M`), security headers, and request routing.

---

## 3. Quickstart: Running with Docker

### A. Core Application (Production Mode)
Starts PostgreSQL, Backend, Frontend, and Nginx Reverse Proxy:
```bash
# 1. Clone & prepare environment
cp .env.example .env

# 2. Launch application stack
docker compose up -d --build
```
Access points:
- **Application Web UI**: [http://localhost](http://localhost) or [http://localhost:3000](http://localhost:3000)
- **Backend API Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Liveness Probe**: [http://localhost/health](http://localhost/health)
- **Readiness Probe**: [http://localhost/ready](http://localhost/ready)
- **Prometheus Metrics**: [http://localhost/metrics](http://localhost/metrics)

### B. Local Development Mode (Live Hot-Reloading)
Mounts source code into containers for real-time changes without rebuilding:
```bash
docker compose -f docker-compose.dev.yml up -d
```

### C. DevOps & Monitoring Stack (Optional Tools)
Launches Jenkins, SonarQube, Prometheus, and Grafana:
```bash
docker compose -f docker-compose.devops.yml up -d
```
Access points:
- **Jenkins Controller**: [http://localhost:8080](http://localhost:8080)
- **SonarQube Quality Gate**: [http://localhost:9000](http://localhost:9000)
- **Prometheus Metric Explorer**: [http://localhost:9090](http://localhost:9090)
- **Grafana Performance Dashboards**: [http://localhost:3001](http://localhost:3001) *(admin / admin)*

---

## 4. CI/CD Pipeline Stages (Jenkinsfile)

The root `Jenkinsfile` implements a production-grade 15-stage declarative pipeline:

| # | Stage Name | Description | Failure Behavior |
|---|---|---|---|
| **1** | `Checkout` | Retrieves Git source revision cleanly. | Abort build |
| **2** | `Environment Validation` | Verifies Docker, Python, Node, and compose CLI availability. | Abort build |
| **3** | `Backend Dependencies` | Installs Python requirements in an isolated virtual environment. | Abort build |
| **4** | `Frontend Dependencies` | Installs npm dependencies using `npm ci`. | Abort build |
| **5** | `Backend Automated Tests` | Runs 14 pytest business scenarios with JUnit XML output. | Abort build |
| **6** | `Frontend Build & Tests` | Compiles Vite production bundle into `dist/`. | Abort build |
| **7** | `Coverage Generation` | Computes test coverage and produces `coverage.xml`. | Abort build |
| **8** | `SonarQube Analysis` | Dispatches static code analysis to SonarQube. | Log warning / proceed |
| **9** | `SonarQube Quality Gate` | Evaluates coverage, bugs, and security vulnerabilities. | Abort build on failure |
| **10**| `Trivy Filesystem Scan` | Scans workspace files and packages for high/critical CVEs. | Log report |
| **11**| `Docker Image Build` | Builds multi-stage non-root container images. | Abort build |
| **12**| `Trivy Container Scan` | Inspects container images for OS-level vulnerabilities. | Block push on Critical |
| **13**| `Docker Image Tagging` | Tags images with semantic build tag and `latest`. | Abort build |
| **14**| `Docker Hub Push` | Pushes images to registry using secure Jenkins credentials. | Abort build |
| **15**| `Deployment` | Staging deploy (feature branch) or **Human Approval Gate** for Prod. | Abort if unapproved |

For setup instructions, see [docs/DEVOPS_SETUP.md](docs/DEVOPS_SETUP.md) and [docs/CI_CD_WORKFLOW.md](docs/CI_CD_WORKFLOW.md).

---

## 5. Security & Vulnerability Scanning

### Trivy Security Scans
```bash
# Scan repository filesystem
trivy fs --severity HIGH,CRITICAL --format table .

# Scan built Docker images
trivy image --severity HIGH,CRITICAL prathmeshnitnaware/invoice-expense-system-backend:latest
```

### Non-Root Container Execution
Both backend and frontend containers run as unprivileged users (`appuser:10001` and `nginx`) with read-only root filesystems where appropriate, blocking host privilege escalation.

---

## 6. Observability, Health & Monitoring

### Metrics (`/metrics`)
The application exposes Prometheus-compatible metrics:
- `http_requests_total`: Counter by handler, method, and HTTP status code.
- `http_request_duration_seconds`: Response latency histogram (p50, p95, p99).
- `process_resident_memory_bytes`: Physical memory usage in MB.
- `process_cpu_seconds_total`: CPU consumption rate.

### Health Probes
- **Liveness (`/health`)**: Confirms web server responsiveness.
- **Readiness (`/ready`)**: Performs live `SELECT 1` database query probe to ensure backend can process transactions before receiving traffic.

---

## 7. Running Tests Locally

```bash
# Run 14 pytest scenarios with coverage report
$env:PYTHONPATH="."; .\venv\Scripts\python -m pytest backend/tests/ -v --cov=backend/app --cov-report=term

# Verify End-to-End Business Automation
$env:PYTHONPATH="."; .\venv\Scripts\python verify_end_to_end.py
```

---

## 8. Documentation Index

- [docs/DEVOPS_SETUP.md](docs/DEVOPS_SETUP.md) &mdash; Detailed setup instructions for Jenkins, SonarQube, Trivy, Prometheus, and Grafana on Windows/Docker.
- [docs/CI_CD_WORKFLOW.md](docs/CI_CD_WORKFLOW.md) &mdash; Branching strategy, webhook configuration, pipeline walkthrough, and disaster recovery.
