from fastapi import APIRouter
from backend.app.api.v1.invoices import router as invoices_router
from backend.app.api.v1.dashboard import router as dashboard_router
from backend.app.api.v1.reports import router as reports_router
from backend.app.api.v1.settings import router as settings_router

api_router = APIRouter()
api_router.include_router(invoices_router, prefix="/invoices", tags=["Invoices"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(reports_router, prefix="/reports", tags=["Reports"])
api_router.include_router(settings_router, prefix="/settings", tags=["Settings"])

