# ==============================================================================
# Stage 1: Build Dependencies
# ==============================================================================
FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ==============================================================================
# Stage 2: Production Runtime
# ==============================================================================
FROM python:3.11-slim AS runner

# Install system dependencies including Tesseract OCR & curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Security: Create unprivileged application user
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /bin/bash -m appuser

WORKDIR /app

# Copy python dependencies from builder
COPY --from=builder /root/.local /home/appuser/.local

# Copy application source code
COPY --chown=appuser:appgroup backend/ /app/backend/
COPY --chown=appuser:appgroup storage/ /app/storage/

# Ensure runtime directories exist and have proper permissions
RUN mkdir -p /app/storage/invoices /app/storage/reports && \
    chown -R appuser:appgroup /app/storage

ENV PATH=/home/appuser/.local/bin:$PATH
ENV PYTHONPATH=/app
ENV UPLOAD_DIR=/app/storage/invoices
ENV REPORT_DIR=/app/storage/reports

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
