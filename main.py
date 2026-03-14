from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from database import connect_db, close_db
from redis_client import connect_redis, close_redis
from handlers import register_event_handlers

from auth_router import router as auth_router
from product_router import router as product_router
from warehouse_router import router as warehouse_router
from operation_router import router as operation_router
from ledger_router import router as ledger_router
from dashboard_router import router as dashboard_router
from alert_router import router as alert_router
from search_router import router as search_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await connect_redis()
    register_event_handlers()
    yield
    await close_db()
    await close_redis()

app = FastAPI(
    title="CoreInventory API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"Error on {request.url}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "Internal server error"},
    )

@app.get("/health")
async def health():
    return {"status": "ok", "service": "CoreInventory API"}

app.include_router(auth_router,      prefix="/api/v1/auth",       tags=["Auth"])
app.include_router(product_router,   prefix="/api/v1/products",   tags=["Products"])
app.include_router(warehouse_router, prefix="/api/v1/warehouses", tags=["Warehouses"])
app.include_router(operation_router, prefix="/api/v1/operations", tags=["Operations"])
app.include_router(ledger_router,    prefix="/api/v1/ledger",     tags=["Ledger"])
app.include_router(dashboard_router, prefix="/api/v1/dashboard",  tags=["Dashboard"])
app.include_router(alert_router,     prefix="/api/v1/alerts",     tags=["Alerts"])
app.include_router(search_router,    prefix="/api/v1/search",     tags=["Search"])
