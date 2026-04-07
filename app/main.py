from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.init_db import init_db

from app.api.routes_users import router as users_router
from app.api.routes_categories import router as categories_router
from app.api.routes_expenses import router as expenses_router
from app.api.routes_ml import router as ml_router

app = FastAPI(title="EcoFinance API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://192.168.1.8:8081",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/")
def root():
    return {"status": "ok", "message": "EcoFinance API corriendo y DB lista"}

app.include_router(users_router)
app.include_router(categories_router)
app.include_router(expenses_router)
app.include_router(ml_router)
