from datetime import date, timedelta

import numpy as np
import pandas as pd
from sqlalchemy import func
from sqlalchemy.orm import Session
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

from app.models.user import User
from app.models.category import Category
from app.models.expense import Expense

class MLService:
    BENCHMARK_CATEGORY_SHARE = {
        "housing": 26.0,
        "food": 16.0,
        "transport": 13.0,
        "health": 8.0,
        "education": 7.0,
        "utilities": 9.0,
        "entertainment": 6.0,
        "savings": 10.0,
        "investment": 5.0,
    }

    def __init__(self, db: Session):
        self.db = db

    def cluster_users(self, k: int = 3):
        users = self.db.query(User).all()
        cats = self.db.query(Category).order_by(Category.id).all()

        if len(users) < 2:
            return {"detail": "Se necesitan al menos 2 usuarios."}

        rows = []
        for u in users:
            exps = self.db.query(Expense).filter(Expense.user_id == u.id).all()
            if not exps:
                continue

            total = sum(e.amount for e in exps)
            per_cat = {c.id: 0.0 for c in cats}

            for e in exps:
                per_cat[e.category_id] = per_cat.get(e.category_id, 0.0) + e.amount

            features = []
            for c in cats:
                features.append((per_cat[c.id] / total) if total > 0 else 0.0)

            features.append(len(exps))
            features.append(float(np.mean([e.amount for e in exps])))

            rows.append((u.id, features))

        if len(rows) < 2:
            return {"detail": "Se necesitan al menos 2 usuarios con gastos."}

        X = np.array([r[1] for r in rows], dtype=float)
        Xs = StandardScaler().fit_transform(X)

        k = max(2, min(k, len(rows)))
        km = KMeans(n_clusters=k, n_init=10, random_state=42)
        labels = km.fit_predict(Xs)

        return [{"user_id": rows[i][0], "cluster": int(labels[i])} for i in range(len(rows))]

    def export_dataset_rows(self):
        rows = (
            self.db.query(
                Expense.user_id,
                User.email,
                Expense.category_id,
                Category.name,
                Expense.amount,
                Expense.movement_type,
                Expense.date,
                User.base_income,
                User.income_frequency,
            )
            .join(User, User.id == Expense.user_id)
            .join(Category, Category.id == Expense.category_id)
            .order_by(Expense.date.desc())
            .all()
        )

        return [
            {
                "user_id": row[0],
                "user_email": row[1],
                "category_id": row[2],
                "category_name": row[3],
                "amount": float(row[4]),
                "movement_type": row[5],
                "date": str(row[6]),
                "base_income": float(row[7]) if row[7] is not None else None,
                "income_frequency": row[8],
            }
            for row in rows
        ]

    def _movement_totals(self, user_id: int | None = None):
        query = self.db.query(Expense.movement_type, func.sum(Expense.amount))
        if user_id is not None:
            query = query.filter(Expense.user_id == user_id)
        query = query.group_by(Expense.movement_type)

        totals = {"expense": 0.0, "income": 0.0, "investment": 0.0}
        for movement_type, total in query.all():
            totals[movement_type] = float(total or 0.0)
        return totals

    def _top_categories(self, user_id: int | None = None, limit: int = 6):
        total_query = self.db.query(func.sum(Expense.amount))
        if user_id is not None:
            total_query = total_query.filter(Expense.user_id == user_id)
        total_amount = float(total_query.scalar() or 0.0)

        query = (
            self.db.query(
                Category.id,
                Category.name,
                func.sum(Expense.amount).label("total"),
            )
            .join(Expense, Expense.category_id == Category.id)
        )
        if user_id is not None:
            query = query.filter(Expense.user_id == user_id)
        query = query.group_by(Category.id, Category.name).order_by(func.sum(Expense.amount).desc())

        rows = query.limit(limit).all()
        denominator = total_amount if total_amount > 0 else 1.0

        return [
            {
                "category_id": row[0],
                "name": row[1],
                "total_amount": float(row[2] or 0.0),
                "percentage": round((float(row[2] or 0.0) / denominator) * 100, 2),
            }
            for row in rows
        ]

    def _month_key(self, dt: date):
        return f"{dt.year:04d}-{dt.month:02d}"

    def _monthly_trends(self, user_id: int | None = None, months: int = 6):
        query = self.db.query(Expense)
        if user_id is not None:
            query = query.filter(Expense.user_id == user_id)

        all_expenses = query.all()
        if not all_expenses:
            return []

        max_date = max(e.date for e in all_expenses)
        month_set = []
        y, m = max_date.year, max_date.month
        for _ in range(months):
            month_set.append(f"{y:04d}-{m:02d}")
            m -= 1
            if m == 0:
                m = 12
                y -= 1
        month_set.reverse()

        buckets = {
            month: {"expense": 0.0, "income": 0.0, "investment": 0.0}
            for month in month_set
        }

        for e in all_expenses:
            key = self._month_key(e.date)
            if key not in buckets:
                continue
            buckets[key][e.movement_type] = buckets[key].get(e.movement_type, 0.0) + float(e.amount)

        trend = []
        for month in month_set:
            row = buckets[month]
            net_balance = row["income"] - (row["expense"] + row["investment"])
            trend.append(
                {
                    "month": month,
                    "expense": round(row["expense"], 2),
                    "income": round(row["income"], 2),
                    "investment": round(row["investment"], 2),
                    "net_balance": round(net_balance, 2),
                }
            )
        return trend

    def _normalize_category_name(self, category_name: str):
        name = (category_name or "").strip().lower()
        if any(k in name for k in ["alquiler", "renta", "vivienda", "casa"]):
            return "housing"
        if any(k in name for k in ["comida", "super", "mercado", "food", "restaurante"]):
            return "food"
        if any(k in name for k in ["transporte", "gasolina", "uber", "bus", "taxi"]):
            return "transport"
        if any(k in name for k in ["salud", "medic", "farmacia", "health"]):
            return "health"
        if any(k in name for k in ["educ", "curso", "univers", "school"]):
            return "education"
        if any(k in name for k in ["luz", "agua", "internet", "servicio", "utilities"]):
            return "utilities"
        if any(k in name for k in ["ocio", "entreten", "netflix", "cine", "gaming"]):
            return "entertainment"
        if any(k in name for k in ["ahorro", "savings"]):
            return "savings"
        if any(k in name for k in ["inversion", "inversi", "investment", "crypto", "stock"]):
            return "investment"
        return "other"

    def _saving_tip_for_category(self, category_name: str) -> str:
        normalized = self._normalize_category_name(category_name)
        tips = {
            "housing": "En vivienda, negocia renovacion de contrato, comparte servicios y limita mejoras no urgentes.",
            "food": "En alimentacion, usa menu semanal, compra al por mayor con lista cerrada y limita domicilios a 1 por semana.",
            "transport": "En transporte, agrupa desplazamientos, prioriza transporte publico y reduce trayectos de alto costo.",
            "health": "En salud, compara farmacias, compra genericos aprobados y programa chequeos preventivos para evitar urgencias costosas.",
            "education": "En educacion, prioriza cursos con retorno laboral claro y aprovecha becas o planes de pago sin interes.",
            "utilities": "En servicios, fija meta mensual de consumo y elimina suscripciones o planes que no uses regularmente.",
            "entertainment": "En ocio, define un tope semanal y elige actividades de bajo costo antes de compras impulsivas.",
            "savings": "En ahorro, automatiza transferencia al inicio del mes y no al final para asegurar constancia.",
            "investment": "En inversion, diversifica en instrumentos de riesgo moderado y evita concentrar todo en un solo activo.",
            "other": "En esta categoria, registra subcategorias para detectar fugas y fija un limite mensual por tipo de gasto.",
        }
        return tips.get(normalized, tips["other"])

    def _build_unified_analysis(self, context: str, conclusions: list[str], suggestions: list[str]) -> str:
        clean_conclusions = [c.strip() for c in conclusions if c and c.strip()]
        clean_suggestions = [s.strip() for s in suggestions if s and s.strip()]

        parts = [f"Analisis {context} (beta):"]
        if clean_conclusions:
            parts.append("Resumen: " + " ".join(clean_conclusions))
        if clean_suggestions:
            parts.append("Plan de accion: " + " ".join(clean_suggestions))

        return " ".join(parts)

    def _default_chat_questions(self) -> list[str]:
        return [
            "Como puedo ahorrar este mes?",
            "Cual es mi categoria con mas gastos?",
            "Que porcentaje de mi sueldo he gastado?",
            "Como puedo empezar a invertir de forma segura?",
        ]

    def _build_chat_answer(self, user: User, question: str) -> str:
        question_normalized = (question or "").strip().lower()
        insights = self.get_user_insights(user)
        movement_totals = insights["movement_totals"]
        top_categories = insights["top_categories"]

        recurring_income = float(user.base_income or 0.0)
        extra_income = float(movement_totals.get("income", 0.0))
        total_income = recurring_income + extra_income
        total_outflow = float(movement_totals.get("expense", 0.0)) + float(
            movement_totals.get("investment", 0.0)
        )

        asks_top_category = (
            "categoria" in question_normalized
            and ("mas" in question_normalized or "mayor" in question_normalized)
            and ("gasto" in question_normalized or "gast" in question_normalized)
        )
        asks_spent_percentage = (
            "porcentaje" in question_normalized
            and ("sueldo" in question_normalized or "ingreso" in question_normalized)
            and ("gasto" in question_normalized or "gast" in question_normalized)
        )
        asks_saving = "ahorr" in question_normalized
        asks_investment = "invert" in question_normalized or "inversion" in question_normalized
        greetings = {
            "hola",
            "holi",
            "buenas",
            "buenos dias",
            "buenas tardes",
            "buenas noches",
            "hello",
            "hi",
        }

        if question_normalized in greetings:
            return (
                "Hola, soy tu asistente financiero de EcoFinance. "
                "Puedo ayudarte con ahorro, inversion, categoria de mayor gasto y porcentaje de sueldo gastado. "
                "Elige una de las preguntas sugeridas o escribe tu consulta en lenguaje natural."
            )

        if asks_top_category:
            top_expense_category = (
                self.db.query(
                    Category.name,
                    func.sum(Expense.amount).label("total"),
                )
                .join(Expense, Expense.category_id == Category.id)
                .filter(Expense.user_id == user.id, Expense.movement_type == "expense")
                .group_by(Category.name)
                .order_by(func.sum(Expense.amount).desc())
                .first()
            )

            total_expense = float(movement_totals.get("expense", 0.0))
            if not top_expense_category or total_expense <= 0:
                return "Aun no tienes categorias con movimientos suficientes para identificar tu mayor gasto."

            top_name = str(top_expense_category[0])
            top_amount = float(top_expense_category[1] or 0.0)
            top_pct = round((top_amount / total_expense) * 100, 2) if total_expense > 0 else 0.0
            tip = self._saving_tip_for_category(top_name)
            return (
                f"Tu categoria con mayor gasto es {top_name} ({top_pct}% de tus gastos). "
                f"Para ahorrar en esa categoria: {tip}"
            )

        if asks_spent_percentage:
            if total_income <= 0:
                return "No puedo calcular el porcentaje gastado de tu sueldo porque no tienes ingreso base configurado o ingresos registrados."
            spent_pct = round((total_outflow / total_income) * 100, 2)
            return (
                f"Has gastado/invertido aproximadamente el {spent_pct}% de tus ingresos totales registrados. "
                "Te recomiendo mantener este valor por debajo de 75% para mejorar capacidad de ahorro."
            )

        if asks_saving:
            recommended_saving = float(insights.get("recommended_saving_amount", 0.0))
            current_saving_capacity = max(0.0, total_income - total_outflow)
            saving_gap = max(0.0, recommended_saving - current_saving_capacity)
            top_tip = (
                self._saving_tip_for_category(top_categories[0]["name"])
                if top_categories
                else "Registra mas movimientos para darte una recomendacion por categoria."
            )
            return (
                f"Meta sugerida de ahorro mensual: {round(recommended_saving, 2)}. "
                f"Capacidad actual estimada: {round(current_saving_capacity, 2)}. "
                f"Brecha de ahorro: {round(saving_gap, 2)}. "
                f"Accion inmediata: {top_tip}"
            )

        if asks_investment:
            if total_income <= 0:
                return "Para recomendar inversion necesito que configures ingreso base o registres ingresos adicionales."
            invest_ratio = round((float(movement_totals.get("investment", 0.0)) / total_income) * 100, 2)
            return (
                f"Actualmente inviertes cerca del {invest_ratio}% de tus ingresos. "
                "Para iniciar/mejorar, define un aporte automatico mensual del 5%-10% en instrumentos diversificados y revisa tu portafolio cada trimestre."
            )

        return (
            "No identifique claramente la intencion de tu pregunta. "
            "Puedo ayudarte con ahorro, inversion, categoria de mayor gasto y porcentaje de sueldo gastado. "
            "Prueba con una pregunta concreta como las sugeridas."
        )

    def chat_with_financial_ai(self, current_user: User, question: str, target_user_id: int) -> dict:
        target_user = self.db.query(User).filter(User.id == target_user_id).first()
        if not target_user:
            return {
                "question": question,
                "answer": "No encontre el usuario objetivo para analizar.",
                "target_user_id": target_user_id,
                "suggested_questions": self._default_chat_questions(),
            }

        if not current_user.is_admin and current_user.id != target_user_id:
            return {
                "question": question,
                "answer": "No tienes permisos para consultar datos de otro usuario.",
                "target_user_id": target_user_id,
                "suggested_questions": self._default_chat_questions(),
            }

        answer = self._build_chat_answer(target_user, question)
        return {
            "question": question,
            "answer": answer,
            "target_user_id": target_user_id,
            "suggested_questions": self._default_chat_questions(),
        }

    def _benchmark_comparison(self, top_categories: list[dict]):
        comparison = []
        for item in top_categories:
            mapped = self._normalize_category_name(item["name"])
            benchmark = self.BENCHMARK_CATEGORY_SHARE.get(mapped)
            if benchmark is None:
                continue
            delta = round(item["percentage"] - benchmark, 2)
            comparison.append(
                {
                    "category_name": item["name"],
                    "user_or_global_percentage": item["percentage"],
                    "benchmark_percentage": benchmark,
                    "delta_percentage": delta,
                }
            )
        return comparison

    def generate_synthetic_dataset_rows(self, users_count: int = 50, months: int = 12, seed: int = 42):
        rng = np.random.default_rng(seed)

        db_categories = self.db.query(Category).all()
        if db_categories:
            categories = [c.name for c in db_categories]
        else:
            categories = [
                "Vivienda",
                "Comida",
                "Transporte",
                "Salud",
                "Educacion",
                "Servicios",
                "Ocio",
                "Ahorro",
                "Inversion",
            ]

        expense_like = [c for c in categories if self._normalize_category_name(c) not in ["savings", "investment"]]
        if not expense_like:
            expense_like = categories

        today = date.today()
        start_date = today - timedelta(days=30 * max(1, months))
        dataset = []

        for user_idx in range(1, users_count + 1):
            profile_income = float(np.clip(rng.normal(1600, 550), 550, 6500))
            investment_ratio = float(np.clip(rng.normal(0.08, 0.04), 0.0, 0.25))
            savings_ratio = float(np.clip(rng.normal(0.12, 0.05), 0.0, 0.35))

            cat_weights = rng.dirichlet(np.ones(len(expense_like)) * 1.8)

            for month_i in range(months):
                month_date = start_date + timedelta(days=30 * month_i)

                salary_noise = float(np.clip(rng.normal(1.0, 0.08), 0.75, 1.25))
                monthly_income = round(profile_income * salary_noise, 2)

                dataset.append(
                    {
                        "user_id": user_idx,
                        "user_email": f"synthetic_user_{user_idx}@example.com",
                        "category_id": 0,
                        "category_name": "Ingreso Base",
                        "amount": monthly_income,
                        "movement_type": "income",
                        "date": str(month_date),
                        "base_income": round(profile_income, 2),
                        "income_frequency": "monthly",
                    }
                )

                invest_amount = round(monthly_income * investment_ratio * float(np.clip(rng.normal(1.0, 0.2), 0.5, 1.4)), 2)
                if invest_amount > 0:
                    dataset.append(
                        {
                            "user_id": user_idx,
                            "user_email": f"synthetic_user_{user_idx}@example.com",
                            "category_id": 0,
                            "category_name": "Inversion",
                            "amount": invest_amount,
                            "movement_type": "investment",
                            "date": str(month_date + timedelta(days=int(rng.integers(3, 25)))),
                            "base_income": round(profile_income, 2),
                            "income_frequency": "monthly",
                        }
                    )

                spend_budget = monthly_income * float(np.clip(1.0 - savings_ratio - investment_ratio, 0.45, 0.95))
                tx_count = int(rng.integers(8, 20))

                for _ in range(tx_count):
                    category_name = str(rng.choice(expense_like, p=cat_weights))
                    tx_amount = round(float(np.clip(rng.normal(spend_budget / tx_count, spend_budget / (tx_count * 2.8)), 2, spend_budget * 0.25)), 2)
                    tx_day = int(rng.integers(1, 28))

                    dataset.append(
                        {
                            "user_id": user_idx,
                            "user_email": f"synthetic_user_{user_idx}@example.com",
                            "category_id": 0,
                            "category_name": category_name,
                            "amount": tx_amount,
                            "movement_type": "expense",
                            "date": str(date(month_date.year, month_date.month, min(tx_day, 28))),
                            "base_income": round(profile_income, 2),
                            "income_frequency": "monthly",
                        }
                    )

        return dataset

    def import_public_dataset_profile(
        self,
        url: str,
        category_column: str,
        value_column: str,
        top_n: int = 10,
    ):
        df = pd.read_csv(url)

        if category_column not in df.columns:
            raise ValueError(f"No existe la columna de categoria: {category_column}")
        if value_column not in df.columns:
            raise ValueError(f"No existe la columna de valor: {value_column}")

        clean = df[[category_column, value_column]].dropna().copy()
        clean[value_column] = pd.to_numeric(clean[value_column], errors="coerce")
        clean = clean.dropna()
        clean = clean[clean[value_column] >= 0]

        grouped = (
            clean.groupby(category_column, as_index=False)[value_column]
            .sum()
            .sort_values(value_column, ascending=False)
        )

        if grouped.empty:
            return {
                "source_url": url,
                "rows_used": 0,
                "profile": [],
            }

        top_rows = grouped.head(max(1, top_n)).copy()
        total = float(top_rows[value_column].sum()) or 1.0

        profile = []
        for _, row in top_rows.iterrows():
            pct = round((float(row[value_column]) / total) * 100, 2)
            profile.append(
                {
                    "category_name": str(row[category_column]),
                    "percentage": pct,
                }
            )

        return {
            "source_url": url,
            "rows_used": int(len(clean)),
            "profile": profile,
        }

    def get_user_insights(self, user: User):
        movement_totals = self._movement_totals(user_id=user.id)
        top_categories = self._top_categories(user_id=user.id)
        monthly_trends = self._monthly_trends(user_id=user.id)
        benchmark_comparison = self._benchmark_comparison(top_categories)

        conclusions: list[str] = []
        suggestions: list[str] = []

        total_outflow = movement_totals["expense"] + movement_totals["investment"]
        total_income = (user.base_income or 0.0) + movement_totals["income"]
        spending_vs_income_ratio = round((total_outflow / total_income), 3) if total_income > 0 else 0.0
        recommended_saving_amount = round(total_income * 0.15, 2) if total_income > 0 else 0.0

        if total_outflow == 0:
            conclusions.append("Aun no tienes movimientos registrados para analizar.")
            suggestions.append("Registra al menos un gasto o ingreso para obtener recomendaciones.")
        else:
            if top_categories:
                conclusions.append(
                    f"Tu categoria mas alta es {top_categories[0]['name']} con {top_categories[0]['percentage']}% del total."
                )
                suggestions.append(self._saving_tip_for_category(top_categories[0]["name"]))

            if user.base_income:
                if total_outflow > user.base_income:
                    conclusions.append("Tus gastos e inversiones superan tu ingreso base.")
                    suggestions.append("Reduce 10% en gastos fijos (servicios/suscripciones) y dirige ese monto a un fondo de emergencia de 3 meses.")
                else:
                    conclusions.append("Tus gastos estan por debajo de tu ingreso base.")

            if spending_vs_income_ratio > 0:
                if spending_vs_income_ratio > 1:
                    suggestions.append("Estas gastando por encima de tus ingresos: aplica regla 50/30/20 durante 8 semanas y bloquea compras no esenciales.")
                elif spending_vs_income_ratio > 0.8:
                    suggestions.append("Tu gasto esta alto: fija un tope semanal por categoria y usa alertas cuando llegues al 80% del presupuesto.")
                else:
                    conclusions.append("Tu relacion gasto/ingreso se mantiene en un rango saludable.")

            if total_income > 0:
                invest_ratio = movement_totals["investment"] / total_income
                if invest_ratio < 0.05:
                    suggestions.append("Para invertir mejor: inicia con 5%-10% mensual en fondo indexado o CDT, con aportes automaticos el dia de pago.")
                elif invest_ratio >= 0.15:
                    conclusions.append("Tienes una buena proporcion de inversion sobre tus ingresos.")
                    suggestions.append("Mantener inversion: rebalancea cada trimestre y conserva un porcentaje en instrumentos de liquidez.")

                savings_gap = max(0.0, recommended_saving_amount - (total_income - total_outflow))
                if savings_gap > 0:
                    suggestions.append(
                        f"Para lograr ahorro del 15%, libera aproximadamente {round(savings_gap, 2)} al mes recortando 2 categorias de bajo impacto."
                    )

            if movement_totals["income"] > 0:
                conclusions.append("Cuentas con ingresos adicionales que ayudan a tu balance.")

            if monthly_trends:
                latest = monthly_trends[-1]
                if latest["net_balance"] < 0:
                    suggestions.append("Tu ultimo mes cerro en negativo. Revisa tus gastos variables para recuperar balance.")
                else:
                    conclusions.append("Tu ultimo mes cerro con balance positivo.")

        if not suggestions:
            suggestions.append("Sigue registrando tus movimientos para mejorar el analisis.")

        unified_analysis = self._build_unified_analysis("personal", conclusions, suggestions)

        return {
            "user_id": user.id,
            "movement_totals": movement_totals,
            "top_categories": top_categories,
            "monthly_trends": monthly_trends,
            "benchmark_comparison": benchmark_comparison,
            "spending_vs_income_ratio": spending_vs_income_ratio,
            "recommended_saving_amount": recommended_saving_amount,
            "conclusions": [unified_analysis],
            "suggestions": [],
        }

    def get_admin_insights(self):
        total_users = self.db.query(User).count()
        users_with_expenses = (
            self.db.query(Expense.user_id).distinct().count()
        )
        movement_totals = self._movement_totals()
        top_categories = self._top_categories()
        monthly_trends = self._monthly_trends()
        benchmark_comparison = self._benchmark_comparison(top_categories)

        investors = (
            self.db.query(Expense.user_id)
            .filter(Expense.movement_type == "investment")
            .distinct()
            .count()
        )

        saver_count = 0
        users = self.db.query(User).all()
        for user in users:
            if not user.base_income:
                continue
            totals = self._movement_totals(user_id=user.id)
            outflow = totals["expense"] + totals["investment"]
            income = (user.base_income or 0.0) + totals["income"]
            if income > 0 and (income - outflow) > 0:
                saver_count += 1

        percent_investors = round((investors / total_users) * 100, 2) if total_users else 0.0
        percent_savers = round((saver_count / total_users) * 100, 2) if total_users else 0.0

        conclusions: list[str] = []
        suggestions: list[str] = []

        if top_categories:
            conclusions.append(
                f"La categoria con mayor gasto global es {top_categories[0]['name']} con {top_categories[0]['percentage']}%."
            )
            suggestions.append(self._saving_tip_for_category(top_categories[0]["name"]))

        conclusions.append(
            f"{percent_investors}% de los usuarios han registrado inversiones."
        )
        conclusions.append(
            f"{percent_savers}% de los usuarios mantienen balance positivo."
        )

        if percent_investors < 20:
            suggestions.append("Activar onboarding de inversion con portafolios modelo (conservador, moderado, agresivo) y aporte automatico sugerido.")
        if percent_savers < 50:
            suggestions.append("Configurar meta de ahorro predeterminada del 15% con seguimiento semanal por usuario.")

        if monthly_trends:
            latest = monthly_trends[-1]
            previous = monthly_trends[-2] if len(monthly_trends) > 1 else None
            if previous and latest["expense"] > previous["expense"] * 1.12:
                suggestions.append("El gasto global mensual crecio de forma acelerada. Conviene activar alertas tempranas por categoria.")
            if latest["net_balance"] < 0:
                suggestions.append("El balance agregado del ultimo mes es negativo. Reforzar mensajes de ahorro e inversion responsable.")

        if not suggestions:
            suggestions.append("Seguir monitoreando cambios mensuales para detectar tendencias.")

        unified_analysis = self._build_unified_analysis("administrativo", conclusions, suggestions)

        return {
            "total_users": total_users,
            "users_with_expenses": users_with_expenses,
            "percent_investors": percent_investors,
            "percent_savers": percent_savers,
            "movement_totals": movement_totals,
            "top_categories": top_categories,
            "monthly_trends": monthly_trends,
            "benchmark_comparison": benchmark_comparison,
            "conclusions": [unified_analysis],
            "suggestions": [],
        }
