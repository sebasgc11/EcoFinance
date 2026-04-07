import numpy as np
from sqlalchemy.orm import Session
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

from app.models.user import User
from app.models.category import Category
from app.models.expense import Expense

class MLService:
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