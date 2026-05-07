from __future__ import annotations

import json
import pickle
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    cohen_kappa_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sqlalchemy.orm import Session

from app.models.expense import Expense
from app.models.user import User
from app.services.ml_service import MLService


@dataclass
class CrispMLQConfig:
    min_rows_for_training: int = 120
    test_size: float = 0.2
    random_state: int = 42
    min_f1: float = 0.65
    min_recall_high_risk: float = 0.60
    min_kappa: float = 0.60
    max_drift_feature_mean_delta: float = 0.30


class CrispMLQService:
    def __init__(self, db: Session):
        self.db = db
        self.ml_service = MLService(db)
        self.config = CrispMLQConfig()
        self.artifacts_dir = Path(__file__).resolve().parents[1] / "ml_artifacts"
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)

    def _utc_now(self) -> str:
        return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

    def _model_path(self) -> Path:
        return self.artifacts_dir / "risk_model.pkl"

    def _metadata_path(self) -> Path:
        return self.artifacts_dir / "risk_model_metadata.json"

    def _last_report_path(self) -> Path:
        return self.artifacts_dir / "crisp_mlq_last_report.json"

    def _weka_arff_path(self, run_id: str) -> Path:
        return self.artifacts_dir / f"risk_training_weka_{run_id}.arff"

    def _latest_weka_arff_path(self) -> Path:
        return self.artifacts_dir / "risk_training_weka_latest.arff"

    def _load_real_dataframe(self) -> pd.DataFrame:
        rows = self.ml_service.export_dataset_rows()
        if not rows:
            return pd.DataFrame()
        return pd.DataFrame(rows)

    def _load_synthetic_dataframe(self, users_count: int, months: int, seed: int) -> pd.DataFrame:
        rows = self.ml_service.generate_synthetic_dataset_rows(
            users_count=users_count,
            months=months,
            seed=seed,
        )
        return pd.DataFrame(rows)

    def _prepare_features(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            return pd.DataFrame()

        clean = df.copy()
        clean["date"] = pd.to_datetime(clean["date"], errors="coerce")
        clean = clean.dropna(subset=["date", "amount", "movement_type", "user_id"])
        clean["year_month"] = clean["date"].dt.strftime("%Y-%m")

        pivot = (
            clean.pivot_table(
                index=["user_id", "year_month"],
                columns="movement_type",
                values="amount",
                aggfunc="sum",
                fill_value=0.0,
            )
            .reset_index()
            .rename_axis(None, axis=1)
        )

        if "expense" not in pivot.columns:
            pivot["expense"] = 0.0
        if "income" not in pivot.columns:
            pivot["income"] = 0.0
        if "investment" not in pivot.columns:
            pivot["investment"] = 0.0

        tx_count = (
            clean.groupby(["user_id", "year_month"]).size().reset_index(name="tx_count")
        )
        avg_amount = (
            clean.groupby(["user_id", "year_month"])["amount"].mean().reset_index(name="avg_amount")
        )

        data = pivot.merge(tx_count, on=["user_id", "year_month"], how="left")
        data = data.merge(avg_amount, on=["user_id", "year_month"], how="left")

        data["outflow"] = data["expense"] + data["investment"]
        data["spend_income_ratio"] = np.where(
            data["income"] > 0,
            data["outflow"] / data["income"],
            0.0,
        )
        data["net_balance"] = data["income"] - data["outflow"]

        # Regla de negocio inicial para supervisado: riesgo financiero mensual.
        data["target_high_risk"] = (
            (data["spend_income_ratio"] > 0.9) | (data["net_balance"] < 0)
        ).astype(int)

        numeric_cols = [
            "expense",
            "income",
            "investment",
            "tx_count",
            "avg_amount",
            "outflow",
            "spend_income_ratio",
            "net_balance",
            "target_high_risk",
        ]
        for col in numeric_cols:
            data[col] = pd.to_numeric(data[col], errors="coerce").fillna(0.0)

        return data

    def _write_weka_arff(self, prepared: pd.DataFrame, run_id: str) -> dict:
        feature_cols = [
            "expense",
            "income",
            "investment",
            "tx_count",
            "avg_amount",
            "outflow",
            "spend_income_ratio",
            "net_balance",
        ]
        class_col = "target_high_risk"
        arff_cols = feature_cols + [class_col]

        if prepared.empty:
            return {
                "generated": False,
                "detail": "No hay datos preparados para exportar a Weka Explorer.",
            }

        export_df = prepared[arff_cols].copy()
        for col in feature_cols:
            export_df[col] = pd.to_numeric(export_df[col], errors="coerce").fillna(0.0)
        export_df[class_col] = export_df[class_col].astype(int).clip(0, 1)

        lines = [
            "% Dataset generado por EcoFinance para validacion en Weka Explorer",
            "% Abrir este archivo en Weka Explorer > Preprocess",
            "% Class attribute: target_high_risk {0,1}",
            "",
            "@relation ecofinance_risk_training",
            "",
        ]
        lines.extend(f"@attribute {col} numeric" for col in feature_cols)
        lines.append("@attribute target_high_risk {0,1}")
        lines.extend(["", "@data"])

        for _, row in export_df.iterrows():
            values = [f"{float(row[col]):.6f}" for col in feature_cols]
            values.append(str(int(row[class_col])))
            lines.append(",".join(values))

        content = "\n".join(lines) + "\n"
        versioned_path = self._weka_arff_path(run_id)
        latest_path = self._latest_weka_arff_path()
        versioned_path.write_text(content, encoding="utf-8")
        latest_path.write_text(content, encoding="utf-8")

        return {
            "generated": True,
            "tool": "Weka Explorer",
            "format": "ARFF",
            "relation": "ecofinance_risk_training",
            "class_attribute": "target_high_risk",
            "rows": int(len(export_df)),
            "versioned_path": str(versioned_path),
            "latest_path": str(latest_path),
            "instructions": [
                "Abrir Weka Explorer.",
                "Ir a Preprocess y cargar risk_training_weka_latest.arff.",
                "En Classify, seleccionar target_high_risk como clase.",
                "Comparar el valor Kappa statistic con el quality gate del proyecto.",
            ],
        }

    def _phase_business_data_understanding(self, real_df: pd.DataFrame) -> dict:
        total_rows = int(len(real_df))
        total_users = int(real_df["user_id"].nunique()) if not real_df.empty else 0
        null_income_ratio = 0.0

        users = self.db.query(User).all()
        if users:
            users_without_income = sum(1 for u in users if u.base_income is None)
            null_income_ratio = round(users_without_income / len(users), 4)

        movement_distribution = {}
        if not real_df.empty and "movement_type" in real_df.columns:
            dist = real_df["movement_type"].value_counts(normalize=True)
            movement_distribution = {
                k: round(float(v), 4) for k, v in dist.to_dict().items()
            }

        return {
            "phase": "business_data_understanding",
            "status": "ok",
            "kpis": {
                "total_real_rows": total_rows,
                "total_real_users": total_users,
                "null_base_income_ratio": null_income_ratio,
                "movement_distribution": movement_distribution,
            },
            "quality_gate_passed": total_rows >= 1,
            "notes": [
                "Objetivo de negocio: predecir riesgo financiero mensual por usuario.",
                "KPI tecnico principal: F1 para clase de alto riesgo.",
                "KPI de negocio: recall de alto riesgo para priorizar alertas.",
                "KPI de confiabilidad academica: indice Kappa de Cohen para validar concordancia del clasificador.",
            ],
        }

    def _phase_data_engineering(
        self,
        include_synthetic: bool,
        synthetic_users: int,
        synthetic_months: int,
        seed: int,
    ) -> tuple[dict, pd.DataFrame]:
        real_df = self._load_real_dataframe()
        frames = [real_df]

        synthetic_rows = 0
        if include_synthetic:
            synthetic_df = self._load_synthetic_dataframe(synthetic_users, synthetic_months, seed)
            synthetic_rows = int(len(synthetic_df))
            frames.append(synthetic_df)

        combined = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
        prepared = self._prepare_features(combined)

        qa_checks = {
            "combined_rows": int(len(combined)),
            "prepared_rows": int(len(prepared)),
            "synthetic_rows": synthetic_rows,
            "missing_ratio": round(float(prepared.isna().mean().mean()), 6) if not prepared.empty else 1.0,
            "class_balance_high_risk": round(float(prepared["target_high_risk"].mean()), 4) if not prepared.empty else 0.0,
        }

        quality_gate = int(len(prepared)) >= self.config.min_rows_for_training

        return (
            {
                "phase": "data_engineering",
                "status": "ok" if quality_gate else "warning",
                "quality_gate_passed": quality_gate,
                "qa": qa_checks,
                "notes": [
                    "Se combinaron datos reales y sinteticos (si fue solicitado).",
                    "Se construyeron features por usuario-mes.",
                ],
            },
            prepared,
        )

    def _compute_metrics(self, y_true: pd.Series, y_pred: np.ndarray, y_prob: np.ndarray) -> dict:
        accuracy = float(accuracy_score(y_true, y_pred))
        precision = float(precision_score(y_true, y_pred, zero_division=0))
        recall = float(recall_score(y_true, y_pred, zero_division=0))
        f1 = float(f1_score(y_true, y_pred, zero_division=0))
        kappa = float(cohen_kappa_score(y_true, y_pred))
        try:
            roc_auc = float(roc_auc_score(y_true, y_prob))
        except ValueError:
            roc_auc = 0.0

        return {
            "accuracy": round(accuracy, 4),
            "precision": round(precision, 4),
            "recall_high_risk": round(recall, 4),
            "f1": round(f1, 4),
            "kappa": round(kappa, 4),
            "roc_auc": round(roc_auc, 4),
        }

    def _phase_model_engineering(self, prepared: pd.DataFrame) -> tuple[dict, Pipeline | None, dict]:
        if prepared.empty:
            return (
                {
                    "phase": "model_engineering",
                    "status": "failed",
                    "quality_gate_passed": False,
                    "notes": ["No hay datos preparados para entrenar."],
                },
                None,
                {},
            )


        feature_cols = [
            "expense",
            "income",
            "investment",
            "tx_count",
            "avg_amount",
            "outflow",
            "spend_income_ratio",
            "net_balance",
        ]

        X = prepared[feature_cols]
        y = prepared["target_high_risk"].astype(int)

        if y.nunique() < 2:
            return (
                {
                    "phase": "model_engineering",
                    "status": "failed",
                    "quality_gate_passed": False,
                    "notes": ["Solo existe una clase en el target; no se puede entrenar clasificador."],
                },
                None,
                {},
            )

        split_strategy = "stratified_random"
        sorted_data = prepared.sort_values("year_month").reset_index(drop=True)
        unique_months = sorted_data["year_month"].dropna().unique().tolist()

        X_train = X_test = y_train = y_test = None
        if len(unique_months) >= 3:
            test_months_count = max(1, int(np.ceil(len(unique_months) * self.config.test_size)))
            test_months_count = min(test_months_count, len(unique_months) - 1)
            selected_test_months = set(unique_months[-test_months_count:])

            train_df = sorted_data[~sorted_data["year_month"].isin(selected_test_months)]
            test_df = sorted_data[sorted_data["year_month"].isin(selected_test_months)]

            if (
                not train_df.empty
                and not test_df.empty
                and train_df["target_high_risk"].nunique() == 2
                and test_df["target_high_risk"].nunique() == 2
            ):
                split_strategy = "temporal_holdout"
                X_train = train_df[feature_cols]
                y_train = train_df["target_high_risk"].astype(int)
                X_test = test_df[feature_cols]
                y_test = test_df["target_high_risk"].astype(int)

        if X_train is None or X_test is None or y_train is None or y_test is None:
            X_train, X_test, y_train, y_test = train_test_split(
                X,
                y,
                test_size=self.config.test_size,
                random_state=self.config.random_state,
                stratify=y,
            )

        candidate_models: dict[str, Pipeline] = {
            "logistic_regression": Pipeline(
                steps=[
                    ("scaler", StandardScaler()),
                    (
                        "clf",
                        LogisticRegression(
                            max_iter=1000,
                            random_state=self.config.random_state,
                        ),
                    ),
                ]
            ),
            "random_forest": Pipeline(
                steps=[
                    (
                        "clf",
                        RandomForestClassifier(
                            n_estimators=300,
                            min_samples_leaf=2,
                            class_weight="balanced_subsample",
                            random_state=self.config.random_state,
                            n_jobs=-1,
                        ),
                    )
                ]
            ),
        }

        selected_model: Pipeline | None = None
        selected_name = ""
        selected_metrics: dict[str, float] = {}
        candidate_metrics: dict[str, dict[str, float]] = {}

        for model_name, candidate in candidate_models.items():
            candidate.fit(X_train, y_train)
            y_pred = candidate.predict(X_test)
            y_prob = candidate.predict_proba(X_test)[:, 1]
            metrics = self._compute_metrics(y_test, y_pred, y_prob)
            candidate_metrics[model_name] = metrics

            score_tuple = (
                metrics["kappa"],
                metrics["f1"],
                metrics["recall_high_risk"],
                metrics["roc_auc"],
            )
            selected_score = (
                selected_metrics.get("kappa", -1.0),
                selected_metrics.get("f1", -1.0),
                selected_metrics.get("recall_high_risk", -1.0),
                selected_metrics.get("roc_auc", -1.0),
            )
            if selected_model is None or score_tuple > selected_score:
                selected_model = candidate
                selected_name = model_name
                selected_metrics = metrics

        split_meta = {
            "feature_cols": feature_cols,
            "train_rows": int(len(X_train)),
            "test_rows": int(len(X_test)),
            "positive_rate_train": round(float(y_train.mean()), 4),
            "positive_rate_test": round(float(y_test.mean()), 4),
            "split_strategy": split_strategy,
            "selected_model": selected_name,
            "candidate_metrics": candidate_metrics,
        }

        phase = {
            "phase": "model_engineering",
            "status": "ok",
            "quality_gate_passed": True,
            "notes": [
                f"Split de validacion: {split_strategy}.",
                f"Modelo seleccionado automaticamente: {selected_name}.",
                "Se compararon LogisticRegression y RandomForest.",
            ],
            "selected_model": selected_name,
            "candidate_metrics": candidate_metrics,
        }

        eval_payload = {
            "X_test": X_test,
            "y_test": y_test,
            "split_meta": split_meta,
            "precomputed_metrics": selected_metrics,
            "selected_model": selected_name,
            "candidate_metrics": candidate_metrics,
        }
        return phase, selected_model, eval_payload

    def _phase_model_evaluation(self, model: Pipeline | None, eval_payload: dict) -> tuple[dict, dict]:
        if model is None or not eval_payload:
            return (
                {
                    "phase": "model_evaluation",
                    "status": "failed",
                    "quality_gate_passed": False,
                    "metrics": {},
                    "notes": ["No existe modelo/evaluacion para validar."],
                },
                {},
            )

        metrics = eval_payload.get("precomputed_metrics")
        if not metrics:
            X_test = eval_payload["X_test"]
            y_test = eval_payload["y_test"]
            y_pred = model.predict(X_test)
            y_prob = model.predict_proba(X_test)[:, 1]
            metrics = self._compute_metrics(y_test, y_pred, y_prob)

        f1 = float(metrics.get("f1", 0.0))
        recall = float(metrics.get("recall_high_risk", 0.0))
        kappa = float(metrics.get("kappa", 0.0))
        quality_gate = (
            f1 >= self.config.min_f1
            and recall >= self.config.min_recall_high_risk
            and kappa >= self.config.min_kappa
        )

        return (
            {
                "phase": "model_evaluation",
                "status": "ok" if quality_gate else "warning",
                "quality_gate_passed": quality_gate,
                "metrics": metrics,
                "selected_model": eval_payload.get("selected_model"),
                "candidate_metrics": eval_payload.get("candidate_metrics", {}),
                "split_strategy": eval_payload.get("split_meta", {}).get("split_strategy"),
                "business_validation": {
                    "meets_f1_target": f1 >= self.config.min_f1,
                    "meets_recall_target": recall >= self.config.min_recall_high_risk,
                    "meets_kappa_target": kappa >= self.config.min_kappa,
                    "kappa_target": self.config.min_kappa,
                    "kappa_interpretation": ">= 0.60 indica concordancia sustancial y modelo confiable para este proyecto.",
                },
            },
            metrics,
        )

    def _phase_deployment(self, model: Pipeline | None, evaluation_ok: bool, train_baseline: dict, run_id: str) -> dict:
        if model is None or not evaluation_ok:
            return {
                "phase": "deployment",
                "status": "skipped",
                "quality_gate_passed": False,
                "deployed": False,
                "notes": ["No se despliega porque no paso calidad de evaluacion."],
            }

        model_payload = {
            "model": model,
            "version": run_id,
        }

        with self._model_path().open("wb") as f:
            pickle.dump(model_payload, f)

        metadata = {
            "version": run_id,
            "trained_at": self._utc_now(),
            "train_baseline": train_baseline,
        }
        with self._metadata_path().open("w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)

        return {
            "phase": "deployment",
            "status": "ok",
            "quality_gate_passed": True,
            "deployed": True,
            "model_version": run_id,
            "notes": ["Modelo desplegado localmente en app/ml_artifacts."],
        }

    def _phase_monitoring(self, prepared: pd.DataFrame, latest_metrics: dict) -> dict:
        if not self._metadata_path().exists() or prepared.empty:
            return {
                "phase": "monitoring_maintenance",
                "status": "warning",
                "quality_gate_passed": False,
                "drift": {},
                "notes": ["No existe baseline suficiente para monitoreo completo."],
            }

        with self._metadata_path().open("r", encoding="utf-8") as f:
            metadata = json.load(f)

        baseline = metadata.get("train_baseline", {})
        feature_cols = baseline.get("feature_cols", [])
        baseline_means = baseline.get("feature_means", {})

        drift = {}
        max_delta = 0.0
        for col in feature_cols:
            if col not in prepared.columns:
                continue
            current_mean = float(prepared[col].mean())
            base_mean = float(baseline_means.get(col, 0.0))
            denom = abs(base_mean) if abs(base_mean) > 1e-6 else 1.0
            delta = abs(current_mean - base_mean) / denom
            drift[col] = round(delta, 4)
            max_delta = max(max_delta, delta)

        quality_gate = max_delta <= self.config.max_drift_feature_mean_delta

        notes = [
            "Monitoreo basado en cambio relativo del promedio por feature.",
            f"Delta maximo observado: {round(max_delta, 4)}",
        ]
        if latest_metrics:
            notes.append(
                f"Ultimo F1 registrado: {latest_metrics.get('f1', 0.0)}"
            )

        return {
            "phase": "monitoring_maintenance",
            "status": "ok" if quality_gate else "warning",
            "quality_gate_passed": quality_gate,
            "drift": drift,
            "max_drift": round(max_delta, 4),
            "notes": notes,
        }

    def run_pipeline(
        self,
        include_synthetic: bool = True,
        synthetic_users: int = 100,
        synthetic_months: int = 12,
        seed: int = 42,
    ) -> dict:
        run_id = datetime.utcnow().strftime("%Y%m%d%H%M%S")

        real_df = self._load_real_dataframe()
        phase_1 = self._phase_business_data_understanding(real_df)

        phase_2, prepared = self._phase_data_engineering(
            include_synthetic=include_synthetic,
            synthetic_users=synthetic_users,
            synthetic_months=synthetic_months,
            seed=seed,
        )
        weka_export = self._write_weka_arff(prepared, run_id)

        phase_3, model, eval_payload = self._phase_model_engineering(prepared)
        phase_4, metrics = self._phase_model_evaluation(model, eval_payload)

        feature_cols = eval_payload.get("split_meta", {}).get("feature_cols", [])
        train_baseline = {
            "feature_cols": feature_cols,
            "feature_means": {
                col: float(prepared[col].mean()) for col in feature_cols if col in prepared.columns
            },
        }

        phase_5 = self._phase_deployment(
            model=model,
            evaluation_ok=bool(phase_4.get("quality_gate_passed")),
            train_baseline=train_baseline,
            run_id=run_id,
        )

        phase_6 = self._phase_monitoring(prepared, metrics)

        report = {
            "framework": "CRISP-ML(Q)",
            "run_id": run_id,
            "executed_at": self._utc_now(),
            "phases": [phase_1, phase_2, phase_3, phase_4, phase_5, phase_6],
            "weka_explorer": weka_export,
            "deployment": {
                "deployed": phase_5.get("deployed", False),
                "model_version": phase_5.get("model_version"),
            },
        }

        with self._last_report_path().open("w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        return report

    def get_latest_report(self) -> dict:
        if not self._last_report_path().exists():
            return {
                "framework": "CRISP-ML(Q)",
                "detail": "Aun no se ha ejecutado el pipeline.",
            }

        with self._last_report_path().open("r", encoding="utf-8") as f:
            report = json.load(f)

        if "weka_explorer" not in report and self._latest_weka_arff_path().exists():
            report["weka_explorer"] = {
                "generated": True,
                "tool": "Weka Explorer",
                "format": "ARFF",
                "relation": "ecofinance_risk_training",
                "class_attribute": "target_high_risk",
                "latest_path": str(self._latest_weka_arff_path()),
                "instructions": [
                    "Abrir Weka Explorer.",
                    "Ir a Preprocess y cargar risk_training_weka_latest.arff.",
                    "En Classify, seleccionar target_high_risk como clase.",
                    "Comparar el valor Kappa statistic con el quality gate del proyecto.",
                ],
            }

        return report

    def get_model_status(self) -> dict:
        has_model = self._model_path().exists()
        metadata = None
        if self._metadata_path().exists():
            with self._metadata_path().open("r", encoding="utf-8") as f:
                metadata = json.load(f)

        return {
            "has_model": has_model,
            "metadata": metadata,
        }

    def predict_user_risk(self, user_id: int) -> dict:
        if not self._model_path().exists():
            return {
                "detail": "No hay modelo desplegado. Ejecuta /ml/crisp-mlq/run primero.",
                "risk_probability": None,
            }

        with self._model_path().open("rb") as f:
            payload = pickle.load(f)
        model: Pipeline = payload["model"]

        expenses = self.db.query(Expense).filter(Expense.user_id == user_id).all()
        if not expenses:
            return {
                "user_id": user_id,
                "risk_probability": 0.0,
                "risk_label": "low",
                "detail": "El usuario no tiene movimientos para evaluar.",
            }

        rows = []
        for e in expenses:
            rows.append(
                {
                    "user_id": e.user_id,
                    "date": str(e.date),
                    "amount": float(e.amount),
                    "movement_type": e.movement_type,
                }
            )

        prepared = self._prepare_features(pd.DataFrame(rows))
        if prepared.empty:
            return {
                "user_id": user_id,
                "risk_probability": 0.0,
                "risk_label": "low",
            }

        latest = prepared.sort_values("year_month").tail(1)
        X = latest[
            [
                "expense",
                "income",
                "investment",
                "tx_count",
                "avg_amount",
                "outflow",
                "spend_income_ratio",
                "net_balance",
            ]
        ]
        prob = float(model.predict_proba(X)[:, 1][0])

        if prob >= 0.7:
            label = "high"
        elif prob >= 0.4:
            label = "medium"
        else:
            label = "low"

        return {
            "user_id": user_id,
            "risk_probability": round(prob, 4),
            "risk_label": label,
            "model_version": payload.get("version"),
        }
