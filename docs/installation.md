# Installation

## Prerequisites

- Node.js 20.19+ or 22.12+ and npm 10+ (Vite 8 requirement; Node 18 is not supported by this frontend toolchain).
- MongoDB 7+ locally or a MongoDB Atlas cluster.
- Git is recommended. AI, SMTP, and n8n are optional integrations.

## Configure

From the repository root, copy the server template and edit it:

```powershell
Copy-Item server/.env.example server/.env
```

On macOS/Linux use `cp server/.env.example server/.env`. Set `MONGO_URI`, `PORT=4000`, `CLIENT_URL=http://localhost:5173`, and a random `JWT_SECRET` (at least 32 characters). A PowerShell example to generate a secret is:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Run that command twice and paste the outputs directly into the ignored local `server/.env` file. Do not use the example placeholder strings as production secrets.

Install both npm workspaces and run from the repository root:

```powershell
npm install
npm run dev
```

Vite is available at `http://localhost:5173`; Express is available at `http://127.0.0.1:4000` by default (or the configured `PORT`). The Vite development proxy forwards `/api` calls to Express over IPv4. Alternatively use separate terminals with `npm run dev:client` and `npm run dev:server`.

The first visitor at `/` sees the public inquiry form. To create demo records, run `npm run seed` from the root; this creates `admin@demo.com` / `password123` and sample leads. Change that password immediately and do not use the demo account in production. To create a fresh workspace without demo data, skip seeding and use `/portal/setup` to create the first admin. Setup is locked while any admin exists and re-opens if the final admin is deleted. Employees alone do not lock setup. Public registration is not available; only an authenticated admin can create employees.

## Common Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run client and API together |
| `npm run dev:client` | Run Vite only |
| `npm run dev:server` | Run Express with nodemon |
| `npm run seed` | Create the demo administrator and sample leads |
| `npm run build` | Build production client assets |
| `npm run lint` | Run client and server lint checks |
| `npm test` | Run backend unit and HTTP tests |
| `npm run start --workspace server` | Start API without nodemon |

## Tests

`npm test` uses random, process-local JWT secrets and does not require a production `.env`. The Mongo integration case is opt-in. Point `MONGO_TEST_URI` at a dedicated disposable database; the test removes User, Lead, and LeadActivity documents from that database before and after running.

```powershell
$env:MONGO_TEST_URI = 'mongodb://127.0.0.1:27017/ai-lead-management-test'
npm test
```

Never point `MONGO_TEST_URI` at a development or production database.