# Implementacion CRISP-ML(Q) en EcoFinance

Este proyecto implementa un pipeline alineado con CRISP-ML(Q) para entrenar y mantener un modelo de riesgo financiero mensual por usuario.

## Fases implementadas

1. Business & Data Understanding

- Objetivo: predecir riesgo financiero mensual (alto/medio/bajo).
- KPIs:
  - F1 minimo para clase alto riesgo.
  - Recall minimo para alto riesgo (prioriza no perder casos criticos).
  - Disponibilidad de datos reales por usuario y movimientos.

2. Data Engineering

- Fuente real: movimientos guardados en BD.
- Fuente sintetica: generador realista para bootstrap.
- Preparacion:
  - Agregacion por usuario-mes.
  - Features: expense, income, investment, tx_count, avg_amount, outflow, spend_income_ratio, net_balance.
  - Target inicial (supervisado): high_risk si ratio gasto/ingreso > 0.9 o balance neto < 0.

3. Model Engineering

- Modelo base: LogisticRegression + StandardScaler (Pipeline sklearn).
- Split estratificado train/test.

4. Model Evaluation

- Metricas: accuracy, precision, recall_high_risk, f1, roc_auc.
- Quality Gates por defecto:
  - f1 >= 0.65
  - recall_high_risk >= 0.60

5. Deployment

- Si pasa quality gates, se despliega localmente en:
  - app/ml_artifacts/risk_model.pkl
  - app/ml_artifacts/risk_model_metadata.json

6. Monitoring & Maintenance

- Monitoreo de drift por cambio relativo del promedio de features.
- Alerta si delta maximo supera umbral configurado.
- Reporte persistente:
  - app/ml_artifacts/crisp_mlq_last_report.json

## Endpoints

- POST /ml/crisp-mlq/run
  - Ejecuta pipeline completo.
- GET /ml/crisp-mlq/report/latest
  - Devuelve ultimo reporte por fases.
- GET /ml/crisp-mlq/model-status
  - Estado de despliegue del modelo.
- GET /ml/risk/me
  - Riesgo del usuario autenticado.
- GET /ml/risk/user/{user_id}
  - Riesgo de un usuario (admin).

## Ejemplo de ejecucion

POST /ml/crisp-mlq/run

{
"include_synthetic": true,
"synthetic_users": 100,
"synthetic_months": 12,
"seed": 42
}

## Operacion recomendada

- Reentrenar semanalmente al inicio.
- Migrar a reentrenamiento diario cuando el volumen real crezca.
- Registrar decisiones de umbral (quality gates) y revisarlas cada mes.
- Mantener backup de artefactos por version de modelo.
