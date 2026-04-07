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
    if "base_income" not in columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN base_income FLOAT NULL")
            )
    if "income_frequency" not in columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN income_frequency VARCHAR(20) NULL")
            )
    if "reset_code" not in columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN reset_code VARCHAR(12) NULL")
            )
    if "reset_code_expires_at" not in columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN reset_code_expires_at DATETIME NULL")
            )

    expense_columns = {column["name"] for column in inspector.get_columns("expenses")}
    if "movement_type" not in expense_columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE expenses ADD COLUMN movement_type VARCHAR(20) NOT NULL DEFAULT 'expense'"
                )
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
    if "is_active" not in category_columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE categories ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1"
                )
            )

    db = SessionLocal()
    try:
        total_users = db.execute(text("SELECT COUNT(*) FROM users")).scalar() or 0

        if total_users == 0:
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
        elif total_users == 1:
            db.execute(text("UPDATE users SET is_admin = 1"))
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
            "Ingreso adicional",
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
                        "INSERT INTO categories (name, is_default, is_active) VALUES (:name, 1, 1)"
                    ),
                    {"name": category_name},
                )
            else:
                db.execute(
                    text(
                        "UPDATE categories SET is_default = 1, is_active = 1 WHERE name = :name"
                    ),
                    {"name": category_name},
                )

        db.commit()
    finally:
        db.close()
