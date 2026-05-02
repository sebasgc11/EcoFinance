"""
Generador sintético standalone (mira MLService.generate_synthetic_dataset_rows)
Salida: app/ml_artifacts/synthetic_dataset_{users}x{months}.csv y .txt
Uso:
    python app/tools/generate_synthetic_dataset.py --users 100 --months 12 --seed 42
"""
import argparse
from datetime import date, timedelta
import numpy as np
import pandas as pd
from pathlib import Path

DEFAULT_CATEGORIES = [
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


def generate(users_count: int = 50, months: int = 12, seed: int = 42, categories=None):
    rng = np.random.default_rng(seed)
    if categories is None:
        categories = DEFAULT_CATEGORIES

    expense_like = [c for c in categories if True]
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


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--users", type=int, default=100)
    parser.add_argument("--months", type=int, default=12)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    out_dir = Path(__file__).resolve().parents[1] / "ml_artifacts"
    out_dir.mkdir(parents=True, exist_ok=True)

    data = generate(users_count=args.users, months=args.months, seed=args.seed)
    df = pd.DataFrame(data)

    csv_path = out_dir / f"synthetic_dataset_{args.users}x{args.months}.csv"
    txt_path = out_dir / f"synthetic_dataset_{args.users}x{args.months}.txt"

    df.to_csv(csv_path, index=False)
    df.to_csv(txt_path, index=False, sep='\t')

    print(f"Wrote {len(df)} rows to {csv_path}")
