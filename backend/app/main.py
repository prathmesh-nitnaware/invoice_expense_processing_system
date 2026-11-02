import logging
import uuid
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from prometheus_fastapi_instrumentator import Instrumentator
from sqlalchemy import text

from backend.app.config import settings
from backend.app.database import init_db, engine
from backend.app.api.v1 import api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [cid:%(correlation_id)s] %(name)s: %(message)s"
)

# Custom logging filter to inject correlation_id
class CorrelationIdFilter(logging.Filter):
    def filter(self, record):
        if not hasattr(record, "correlation_id"):
            record.correlation_id = "-"
        return True

for handler in logging.root.handlers:
    handler.addFilter(CorrelationIdFilter())

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database schema...", extra={"correlation_id": "startup"})
    init_db()
    logger.info("System startup complete. Ready to serve requests.", extra={"correlation_id": "startup"})
    yield
    logger.info("System shutdown initiated.", extra={"correlation_id": "shutdown"})

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Automated AI-powered invoice extraction, validation, and expense reporting.",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Correlation ID and Request Timing Middleware
@app.middleware("http")
async def correlation_id_and_timing_middleware(request: Request, call_next):
    # Retrieve incoming correlation id or generate a new unique id
    correlation_id = request.headers.get("X-Correlation-ID") or request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.correlation_id = correlation_id

    start_time = time.perf_counter()
    logger.info(
        f"Incoming request: {request.method} {request.url.path}",
        extra={"correlation_id": correlation_id}
    )

    response = await call_next(request)

    process_time = time.perf_counter() - start_time
    response.headers["X-Correlation-ID"] = correlation_id
    response.headers["X-Process-Time"] = f"{process_time:.4f}s"

    logger.info(
        f"Completed request: {request.method} {request.url.path} - Status: {response.status_code} ({process_time:.4f}s)",
        extra={"correlation_id": correlation_id}
    )

    return response

# Prometheus Metrics Instrumentation
instrumentator = Instrumentator(
    should_group_status_codes=False,
    should_ignore_untemplated=True,
    excluded_handlers=["/metrics", "/health", "/ready"]
)
instrumentator.instrument(app).expose(app, endpoint="/metrics")

# Centralized Exception Handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    cid = getattr(request.state, "correlation_id", "-")
    logger.warning(
        f"Validation error on {request.url.path}: {exc.errors()}",
        extra={"correlation_id": cid}
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Input validation failed", "errors": exc.errors()}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    cid = getattr(request.state, "correlation_id", "-")
    logger.error(
        f"Unhandled exception on {request.url.path}: {exc}",
        exc_info=True,
        extra={"correlation_id": cid}
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred."}
    )

# Include API Router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Liveness probe (Kubernetes/Docker liveness)
@app.get("/health", tags=["Health & Observability"])
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION
    }

# Readiness probe (Checks database connection)
@app.get("/ready", tags=["Health & Observability"])
def readiness_check():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        logger.error(f"Readiness check failed - database unavailable: {e}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "not_ready",
                "database": "disconnected",
                "service": settings.PROJECT_NAME
            }
        )

    return {
        "status": "ready",
        "database": db_status,
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION
    }
