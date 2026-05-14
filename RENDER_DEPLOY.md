# Despliegue en Render

Repositorio:

```text
https://github.com/sebasgc11/EcoFinance
```

## Arquitectura

El proyecto se despliega en tres partes:

- Frontend web: Render Static Site (`ecofinance-web`).
- Backend FastAPI: Render Web Service (`ecofinance-api`).
- Base de datos: MySQL/MariaDB publica externa.

Render puede alojar el frontend y el backend. Render no ofrece MySQL administrado nativo, por eso la base MySQL debe estar en un proveedor externo compatible con MySQL/MariaDB.

## Base de datos MySQL

Tu base local actual esta en XAMPP/MariaDB:

```text
127.0.0.1:3307
database: ecofinance
user: root
```

Esa base solo existe en tu computador. Para produccion necesitas crear una base MySQL publica y luego importar el dump.

Ejemplos de proveedores compatibles:

- Aiven MySQL
- Railway MySQL
- Clever Cloud MySQL
- AlwaysData MySQL
- Un servidor propio con MySQL/MariaDB

## Exportar la base local

Desde la raiz del proyecto:

```powershell
New-Item -ItemType Directory -Force -Path db_exports
& "C:\xampp\mysql\bin\mysqldump.exe" -h 127.0.0.1 -P 3307 -u root --default-character-set=utf8mb4 --databases ecofinance --routines --events --single-transaction --skip-lock-tables | Out-File -FilePath db_exports\ecofinance_mysql_dump.sql -Encoding utf8
```

El archivo queda en:

```text
db_exports/ecofinance_mysql_dump.sql
```

Esta carpeta esta en `.gitignore` porque el dump contiene datos reales y no debe subirse al repositorio publico.

## Importar la base en MySQL publico

Cuando tengas el host, puerto, usuario y password de tu base MySQL publica:

```bash
mysql -h HOST -P PORT -u USER -p --default-character-set=utf8mb4 < db_exports/ecofinance_mysql_dump.sql
```

Luego arma la variable:

```env
DATABASE_URL=mysql+pymysql://USER:PASSWORD@HOST:PORT/ecofinance?charset=utf8mb4
```

## Blueprint de Render

El repo incluye:

```text
render.yaml
```

En Render:

1. New > Blueprint.
2. Selecciona el repo `sebasgc11/EcoFinance`.
3. Rama: `render-deploy` o la rama donde este `render.yaml`.
4. Blueprint Path: `render.yaml`.
5. Render creara:
   - `ecofinance-api`
   - `ecofinance-web`

## Variables para `ecofinance-api`

```env
DATABASE_URL=mysql+pymysql://USER:PASSWORD@HOST:PORT/ecofinance?charset=utf8mb4
DB_FALLBACK_TO_SQLITE=false
ADMIN_EMAIL=tu_correo
ADMIN_PASSWORD=tu_password_admin
ADMIN_NAME=Administrador
BACKEND_CORS_ORIGINS=https://URL-DE-ECOFINANCE-WEB.onrender.com
```

El backend usa:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## Variables para `ecofinance-web`

```env
EXPO_PUBLIC_API_URL=https://URL-DE-ECOFINANCE-API.onrender.com
```

El frontend compila con:

```bash
npm install && npm run build:web
```

Y publica:

```text
EcoFinanceApp/deploy-web
```

## Verificacion

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

Si abre pero no carga datos:

- Revisa `EXPO_PUBLIC_API_URL`.
- Revisa `BACKEND_CORS_ORIGINS`.
- Revisa que `DATABASE_URL` no use `127.0.0.1`.
