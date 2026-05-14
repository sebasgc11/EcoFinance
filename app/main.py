from fastapi import FastAPI
from fastapi.responses import FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from app.db.init_db import init_db
from app.db import session as db_session

from app.api.routes_users import router as users_router
from app.api.routes_categories import router as categories_router
from app.api.routes_expenses import router as expenses_router
from app.api.routes_ml import router as ml_router

app = FastAPI(title="EcoFinance API")
BASE_DIR = Path(__file__).resolve().parents[1]
FAVICON_PATH = BASE_DIR / "EcoFinanceApp" / "assets" / "images" / "favicon.png"

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "EcoFinance API corriendo",
        "database_url": db_session.active_database_url,
    }

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    if FAVICON_PATH.exists():
        return FileResponse(FAVICON_PATH, media_type="image/png")
    return Response(status_code=204)

app.include_router(users_router)
app.include_router(categories_router)
app.include_router(expenses_router)
app.include_router(ml_router)
