from sqlalchemy import inspect, text

from app.core.config import settings
from app.db.session import engine, SessionLocal
from app.models.base import Base
from app.core.security import hash_password

# Importa modelos para que SQLAlchemy los registre
from app.models.user import User
from app.models.category import Category
from app.models.expense import Expense

def init_db():
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "password_hash" not in columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL")
            )
    if "is_admin" not in columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0"
                )
            )
    if "phone" not in columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN phone VARCHAR(30) NULL")
            )

    category_columns = {
        column["name"] for column in inspector.get_columns("categories")
    }
    if "is_default" not in category_columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE categories ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT 0"
                )
            )

    db = SessionLocal()
    try:
        existing_admin = db.execute(
            text("SELECT id FROM users WHERE email = :email LIMIT 1"),
            {"email": settings.ADMIN_EMAIL},
        ).first()
        if not existing_admin:
            db.execute(
                text(
                    "INSERT INTO users (name, email, password_hash, is_admin) "
                    "VALUES (:name, :email, :password_hash, 1)"
                ),
                {
                    "name": settings.ADMIN_NAME,
                    "email": settings.ADMIN_EMAIL,
                    "password_hash": hash_password(settings.ADMIN_PASSWORD),
                },
            )
            db.commit()

        default_categories = (
            "Gastos generales",
            "Alimentacion",
            "Transporte",
            "Vivienda",
            "Servicios",
            "Salud",
            "Educacion",
            "Ocio",
            "Compras",
            "Suscripciones",
            "Ingresos",
            "Inversiones",
            "Otro",
        )

        for category_name in default_categories:
            existing_category = db.execute(
                text("SELECT id FROM categories WHERE name = :name LIMIT 1"),
                {"name": category_name},
            ).first()
            if not existing_category:
                db.execute(
                    text(
                        "INSERT INTO categories (name, is_default) VALUES (:name, 1)"
                    ),
                    {"name": category_name},
                )
            else:
                db.execute(
                    text(
                        "UPDATE categories SET is_default = 1 WHERE name = :name"
                    ),
                    {"name": category_name},
                )

        db.commit()
    finally:
        db.close()
