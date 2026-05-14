# Despliegue en Render

Repositorio:

```text
https://github.com/sebasgc11/EcoFinance
```

## Importante

Tu base actual de XAMPP/MariaDB en `127.0.0.1:3307` solo existe en tu computador. Render no puede conectarse a esa base local. Para que la app pública muestre datos reales necesitas una base MySQL/MariaDB pública.

Puedes usar una base externa compatible con MySQL, por ejemplo Aiven, Railway, Clever Cloud u otro proveedor. Necesitas una URL como:

```env
DATABASE_URL=mysql+pymysql://USER:PASSWORD@HOST:PORT/ecofinance?charset=utf8mb4
```

## Opción recomendada en Render

Este repo ya incluye `render.yaml`, así que puedes usar Render Blueprint.

1. Entra a Render.
2. New > Blueprint.
3. Conecta el repo `sebasgc11/EcoFinance`.
4. Render detectará `render.yaml`.
5. Crea los dos servicios:
   - `ecofinance-api`
   - `ecofinance-web`

## Variables para `ecofinance-api`

En el servicio backend configura:

```env
DATABASE_URL=mysql+pymysql://USER:PASSWORD@HOST:PORT/ecofinance?charset=utf8mb4
DB_FALLBACK_TO_SQLITE=false
ADMIN_EMAIL=tu_correo
ADMIN_PASSWORD=tu_password_admin
ADMIN_NAME=Administrador
BACKEND_CORS_ORIGINS=https://URL-DE-ECOFINANCE-WEB.onrender.com
```

El comando de inicio del backend es:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## Variables para `ecofinance-web`

En el servicio frontend configura:

```env
EXPO_PUBLIC_API_URL=https://URL-DE-ECOFINANCE-API.onrender.com
```

El build del frontend usa:

```bash
npm install && npm run build:web
```

Y publica:

```text
EcoFinanceApp/deploy-web
```

## Verificación

Backend:

```text
https://URL-DE-ECOFINANCE-API.onrender.com/
```

Debe responder:

```json
{"status":"ok","message":"EcoFinance API corriendo","database":"mysql"}
```

Frontend:

```text
https://URL-DE-ECOFINANCE-WEB.onrender.com
```

Si el frontend abre pero no carga datos:

- Revisa `EXPO_PUBLIC_API_URL`.
- Revisa `BACKEND_CORS_ORIGINS`.
- Revisa que `DATABASE_URL` sea pública, no `127.0.0.1`.

## Demo sin MySQL pública

Solo para pruebas rápidas, puedes poner:

```env
DB_FALLBACK_TO_SQLITE=true
```

Pero no es recomendado para entrega final, porque en Render el almacenamiento del plan gratuito puede no conservar tus datos como una base real.
