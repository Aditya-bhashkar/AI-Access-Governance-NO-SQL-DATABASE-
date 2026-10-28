# AI Access Governance Dashboard

A centralized web application for tracking and governing who has access to AI APIs (ChatGPT, Gemini, Claude, GitHub Copilot, AWS Bedrock, Azure OpenAI, and others) across an organization. It records each access grant with its owner, business unit, vendor, and expiry date, flags grants that are about to expire, and keeps an audit trail of every change.

The backend is a **FastAPI** REST API backed by **MongoDB** (via the async **Motor** driver). The frontend is a **React 19** single-page app built with **Vite** and **Material UI**.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Roles and Permissions](#roles-and-permissions)
- [API Overview](#api-overview)
- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
- [Run Instructions](#run-instructions)
- [Running the Migration Script](#running-the-migration-script)
- [Configuration Reference](#configuration-reference)
- [Known Limitations](#known-limitations)
- [License](#license)

---

## Project Overview

Organizations adopting AI APIs often end up with access grants spread across teams, with no single view of who holds a key, for which application, through which vendor, and when it expires. This project provides that view.

Key ideas:

- **Access records** describe one grant: the employee username, the application using it, the business unit, the IT and business points of contact, the vendor, the issue date, and the expiry date.
- **Status is computed**, not typed in. A record is `Active`, `Expiring Soon` (30 days or fewer remaining), or `Expired`, based on its expiry date.
- **Role-based access control (RBAC)** decides who sees what. Regular users manage only their own records; admins and superadmins see all records.
- **Every change is audited**, so governance teams can answer "who changed this, and when?"

---

## Features

### Access record management
- Create, view, edit, and delete AI API access records
- Server-side search, filtering, sorting, and pagination
- Full-text search across username, application name, business unit, and vendor
- Automatic status calculation (`Active` / `Expiring Soon` / `Expired`)
- Per-record audit history

### Dashboard and analytics
- Overview counts: total, active, expiring soon, expired
- Breakdowns by vendor and by business unit
- List of records expiring soon
- Recent activity feed
- Analytics are scoped to the viewer's permissions (users see their own data only)

### Audit logging
- Records every create, update, and delete on access records
- Records user-management actions (creation, status changes, role changes, deletions)
- Browsable audit log for admins, filterable by entity, user, and time

### Authentication and user management
- Self-service registration (always creates a normal `user`)
- JWT bearer-token login with bcrypt-hashed passwords
- Profile page for editing one's own name and email
- Admin user management: view, edit, activate or deactivate, delete
- Superadmin-only admin management, including promoting users to admin or demoting admins to user
- Superadmins are protected from every API-level administrative action, and are created only through a server-side script

### Operations
- `/health`, `/health/db`, and `/` endpoints for liveness, database connectivity, and service metadata
- Interactive API documentation at `/docs` (Swagger UI) and `/redoc`
- Standard JSON response envelope with readable validation errors
- MongoDB indexes are created automatically on startup

---

## Tech Stack

| Layer | Technology |
|---|---|
| API framework | FastAPI 0.115, Uvicorn |
| Data validation | Pydantic 2.9, pydantic-settings |
| Database | MongoDB, Motor 3.3 (async driver) |
| Auth | python-jose (JWT, HS256), bcrypt |
| Frontend | React 19, Vite 8, React Router 7 |
| UI | Material UI 9, Emotion, MUI Icons |
| Forms and data | react-hook-form, date-fns, Axios, Recharts |
| Tooling | ESLint 10 |

---

## Project Structure

```
AI-Access-Governance-NO-SQL-DATABASE--main/
├── Backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app: CORS, routers, error handlers, health checks
│   │   ├── core/
│   │   │   ├── config.py           # Settings loaded from environment / .env
│   │   │   ├── permissions.py      # Centralized RBAC policy (single source of truth)
│   │   │   └── security.py         # Password hashing, JWT create/decode
│   │   ├── db/database.py          # Motor client, index creation, legacy-user normalization
│   │   ├── dependencies/           # get_current_user and role-guard dependencies
│   │   ├── api/routes/             # auth, users, api_access, analytics, audit
│   │   ├── services/               # Business logic per domain
│   │   ├── repositories/           # MongoDB queries per collection
│   │   ├── schemas/                # Pydantic request/response models
│   │   ├── utils/                  # Response envelope, status computation
│   │   └── scripts/create_superadmin.py
│   ├── migration/                  # One-time PostgreSQL → MongoDB migration script
│   ├── requirements.txt
│   ├── .env.example
│   └── alembic.ini                 # Leftover config; no migrations are used
└── Frontend/
    ├── src/
    │   ├── pages/                  # Login, Register, Dashboard, Records, Users, Audit, Admins, …
    │   ├── components/             # Table, Sidebar, Navbar, AuditHistory, GovernanceAnalytics, …
    │   ├── context/                # AuthContext, RecordsContext
    │   ├── routes/index.jsx        # Route guards (ProtectedRoute / PublicRoute)
    │   ├── services/               # Axios client and API wrappers
    │   ├── constants/              # Vendors, business units, regions, expiry threshold
    │   └── utils/                  # Role helpers, date utilities
    ├── vite.config.js
    ├── package.json
    └── .env
```

---

## Roles and Permissions

| Role | Access records | Analytics | User management | Audit logs | Admin management |
|---|---|---|---|---|---|
| `user` | Own records only | Own data | Own profile only | — | — |
| `admin` | All records | All records | Manage normal users | View | — |
| `superadmin` | All records | All records | Manage users and admins; change roles | View | Yes |

Rules that apply to every role:

- Nobody can change their own status, role, or delete their own account through the admin endpoints.
- Admins can manage only normal users. They cannot manage other admins.
- Superadmin accounts cannot be modified or deleted through the API by anyone.
- Public registration cannot create admins or superadmins.
- Unknown or missing role values are treated as `user` (fail closed).

The frontend route guards are a UX convenience only. Every API call is authorized again on the server.

---

## API Overview

The interactive docs are available at `http://localhost:8000/docs` once the backend is running. All endpoints except registration, login, and health checks require `Authorization: Bearer <token>`.

| Area | Method and path | Purpose |
|---|---|---|
| Health | `GET /`, `GET /health`, `GET /health/db` | Service metadata, liveness, database ping |
| Auth | `POST /auth/register` | Create a normal user account |
| Auth | `POST /auth/login` | Exchange email and password for a JWT |
| Access records | `GET /api-access` | List records with search, filter, sort, pagination |
| Access records | `POST /api-access` | Create a record |
| Access records | `GET /api-access/{record_id}` | Get one record |
| Access records | `PUT /api-access/{record_id}` | Update a record |
| Access records | `DELETE /api-access/{record_id}` | Delete a record |
| Analytics | `GET /analytics/overview`, `/complete`, `/vendor`, `/business-unit`, `/expiring-soon`, `/recent` | Dashboard data |
| Audit | `GET /api-access/{record_id}/audit` | History for one record |
| Audit | `GET /audits/recent`, `GET /audits/user/{user_id}` | Global and per-user audit trail |
| Users | `GET /users/me` | Current user profile |
| Users | `GET /users`, `GET /users/{user_id}` | List and view users (admins and above) |
| Users | `POST /users/admin` | Create an admin (superadmin only) |
| Users | `PATCH /users/{user_id}` | Edit name or email |
| Users | `PATCH /users/{user_id}/status` | Activate or deactivate |
| Users | `PATCH /users/{user_id}/role` | Change role (superadmin only) |
| Users | `DELETE /users/{user_id}` | Delete a user |

All responses use a common envelope with `success`, `message`, and `data` fields.

---

## Prerequisites

- **Python 3.10 or newer** (the code uses `X | None` type syntax)
- **Node.js** 20.19+ or 22.12+ (required by Vite 8) and npm
- **MongoDB 6.0 or newer**, running locally or reachable over the network
  - Local option: install MongoDB Community Server, or run it in Docker:
    ```bash
    docker run -d --name mongo -p 27017:27017 mongo:7
    ```
- Git (to clone the repository)

---

## Setup Instructions

### 1. Get the code

```bash
git clone <your-repository-url> AI-Access-Governance-NO-SQL-DATABASE
cd AI-Access-Governance-NO-SQL-DATABASE
```

If you received the project as a ZIP archive, extract it and open the extracted folder instead.

### 2. Backend setup

```bash
cd Backend

# Create and activate a virtual environment
python -m venv .venv

# macOS / Linux
source .venv/bin/activate
# Windows (PowerShell)
# .venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

Create the environment file from the template:

```bash
# macOS / Linux
cp .env.example .env
# Windows (PowerShell)
# Copy-Item .env.example .env
```

Then open `.env` and set a **new** secret key. The key in `.env.example` is a sample value and must not be used in any real deployment:

```bash
openssl rand -hex 32
```

Paste the output as the value of `SECRET_KEY`. The application refuses to start if the key is shorter than 32 characters.

### 3. Frontend setup

```bash
cd ../Frontend
npm install
```

The frontend reads its API address from `Frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Change this value if the backend runs on a different host or port.

### 4. Create the first superadmin

Superadmins cannot be created through the API. Create the first one with the bootstrap script, from the `Backend` folder with the virtual environment active:

```bash
python -m app.scripts.create_superadmin you@example.com
```

- If the email is not yet registered, the script prompts for a name and a password (minimum 8 characters) and creates the account.
- If the email already belongs to an account, that account is promoted to superadmin and reactivated.

---

## Run Instructions

Start MongoDB first, then run the backend and frontend in two terminals.

### Terminal 1: Backend

```bash
cd Backend
# activate the virtual environment if it is not already active
uvicorn app.main:app --reload --port 8000
```

On startup the app connects to MongoDB, creates its indexes, and normalizes any legacy user roles. You should see `Connected to MongoDB: ai_access_governance`.

Verify it is running:

- API root: http://localhost:8000/
- Database check: http://localhost:8000/health/db
- Swagger UI: http://localhost:8000/docs

### Terminal 2: Frontend

```bash
cd Frontend
npm run dev
```

Open the URL Vite prints, normally http://localhost:5173.

### First login

1. Sign in with the superadmin account created in step 4 of the setup.
2. Register additional users from the Register page, or create them from the User Management page.
3. Use **Admin Management** (superadmin only) to promote users to admin.

### Other useful commands

| Command | Location | Purpose |
|---|---|---|
| `npm run build` | Frontend | Produce a production build in `dist/` |
| `npm run preview` | Frontend | Serve the production build locally |
| `npm run lint` | Frontend | Run ESLint |
| `uvicorn app.main:app --port 8000` | Backend | Run the API without auto-reload |

---

## Running the Migration Script

`Backend/migration/migrate_postgres_to_monogodb.py` is a one-time utility for moving data from an older PostgreSQL schema into MongoDB. It is **not** needed for normal operation.

It additionally requires packages that are not in `requirements.txt`:

```bash
pip install sqlalchemy psycopg2-binary
```

Then set the source and target connection details and run it:

```bash
export DATABASE_URL="postgresql://user:password@localhost/source_db"
export MONGODB_URL="mongodb://localhost:27017"
export MONGODB_DB_NAME="ai_access_governance"
python migration/migrate_postgres_to_monogodb.py
```

Back up the target database before running the script.

---

## Configuration Reference

Backend variables, set in `Backend/.env`:

| Variable | Default | Description |
|---|---|---|
| `APP_NAME` | `AI Access Governance Dashboard` | Shown in API metadata |
| `APP_VERSION` | `2.0.0` | Shown in API metadata |
| `DEBUG` | `false` | Debug flag |
| `ENVIRONMENT` | `production` | Reported by the root endpoint |
| `MONGODB_URL` | `mongodb://localhost:27017` | MongoDB connection string |
| `MONGODB_DB_NAME` | `ai_access_governance` | Database name |
| `SECRET_KEY` | *(required)* | JWT signing key, at least 32 characters |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Token lifetime |
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost:5173` | Comma-separated CORS origins |

Frontend variables, set in `Frontend/.env`:

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API |

---

## Known Limitations

These points are observations from the code as delivered, so you know what to expect before deploying.

- **No LICENSE file.** The API metadata declares MIT, but the archive does not include a license file.
- **Leftover files.** `Backend/alembic.ini` is present, but there is no Alembic setup or migrations folder, and schema changes are not versioned.
- **Migration dependencies.** The migration script needs SQLAlchemy and psycopg2, which are not listed in `requirements.txt`.
- **Unused frontend code.** `src/services/mockData.js` and `src/services/api.js` are not referenced by the app. The app uses `src/services/apiService.js`. `VITE_USE_MOCK` is defined in `Frontend/.env` but nothing reads it.
- **Committed frontend env file.** `Frontend/.env` is not ignored by Git, and the backend `.gitignore` ignores only the backend `.env`. Keep environment files out of version control in any real deployment.
- **Placeholder contact details.** The API metadata lists `it-admin@example.com` as the contact address. Update it for your organization.
- **Local-only defaults.** CORS origins, MongoDB URL, and the API base URL all default to localhost. Production deployment needs its own configuration, HTTPS, and a secrets manager for `SECRET_KEY`.
- **No automated tests** are included in the archive.

---

## License

The API metadata declares the project as MIT-licensed. Add a `LICENSE` file to the repository to make this explicit.
