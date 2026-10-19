# LeadPulse AI

**Smart AI Lead Qualification & CRM** — capture inquiries, understand buyer intent, and help your team follow up with confidence.

LeadPulse AI is a self-hosted lead management application built for businesses that want a lightweight, configurable CRM with AI-assisted qualification. You own the source code, database, provider keys, and deployment.

> This is software, not a managed service. Configure your own infrastructure, secrets, privacy notices, and data-retention policies before handling real customer information.

## Product overview

- **Groq Llama 3.3 qualification:** score and prioritize leads, summarize intent, and draft a contextual follow-up. If Groq is not configured or unavailable, the application uses a safe local fallback.
- **One-click WhatsApp outreach:** open a direct `wa.me` conversation with the lead and a suggested message.
- **Budget and timeline signals:** identify budgets from inquiry text and capture purchase timelines.
- **Language-aware follow-up:** detect English, Hindi, and Hinglish inquiries and draft a response in the corresponding language.
- **Lead workspace:** search, filter, assign, and update lead records; view activity history and customer inquiry details.
- **At-a-glance KPIs:** monitor lead totals, qualification, status pipeline, recent activity, and other dashboard metrics.
- **CSV export:** download the leads available to the signed-in user.
- **Team access:** admins can invite employees, assign leads, and manage staff access.
- **Optional round-robin assignment:** admins can enable persistent auto-assignment of public inquiries across active employees; manual assignment remains the default.
- **Secure authentication:** bcrypt password hashing, in-memory access tokens, and `httpOnly` refresh cookies.
- **Optional integrations:** SMTP notifications and password reset, protected webhooks, and importable n8n workflows.

## Technology

| Area | Technology |
| --- | --- |
| Frontend | React 19, Vite 8, React Router, Tailwind CSS 4 |
| Backend | Node.js, Express 5 |
| Database | MongoDB with Mongoose |
| Validation and forms | Zod, React Hook Form |
| AI qualification | Groq Cloud API (`llama-3.3-70b-versatile`) |
| Authentication | JWT, bcryptjs, secure HTTP cookies |

## Requirements

- Node.js **20.19+** or **22.12+**, and npm 10+. The included Vite 8 build tooling does not support Node 18.
- A MongoDB Atlas account or a reachable MongoDB server.
- A Groq Cloud account and API key for live AI qualification (optional; check Groq for current free-tier availability and limits; the fallback still works without a key).
- A modern browser. For deployment, use HTTPS and a Node-capable API host.

## Install and run locally

### 1. Extract the package

Extract the CodeCanyon ZIP to a writable folder. Open a terminal in the extracted project root (the folder containing the root `package.json`).

### 2. Create MongoDB credentials

Create a free MongoDB Atlas cluster and database user. In **Network Access**, allow your development machine's IP address. Copy the application connection string and replace its database name with `leadpulse-ai` if desired. URL-encode reserved characters in the database password.

### 3. Configure the API

Copy the server environment template and edit the new file:

```powershell
Copy-Item server/.env.example server/.env
```

Set at least:

```dotenv
NODE_ENV=development
PORT=4000
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>/<database>?retryWrites=true&w=majority
JWT_SECRET=<a-unique-random-secret-at-least-32-characters>
GROQ_API_KEY=<your-groq-api-key>
```

Generate a strong JWT secret in PowerShell with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

`JWT_SECRET` is used to derive separate signing keys for access and refresh tokens. Never publish `.env` files or put API secrets in frontend variables.

Get a Groq key from the Groq Cloud console and add it to `GROQ_API_KEY`. Leave the value blank to use the built-in qualification fallback. More options are listed in [docs/environment.md](docs/environment.md) and [docs/ai-setup.md](docs/ai-setup.md).

For the frontend, optionally copy `client/.env.example` to `client/.env`. Leave `VITE_API_URL` unset for local development so Vite uses the same-origin proxy. Set it only when building against a separately hosted API; it is a public URL, not a place for secrets.

### 4. Install dependencies

This repository uses npm workspaces. Run the install once from the project root; it installs dependencies for both `client` and `server`:

```powershell
npm install
```

If you are intentionally working on a package in isolation, install from its folder with `npm install` in `server/` or `client/` instead. The root install is recommended for normal setup and the combined development command.

### 5. Add demo data or create the first administrator

To load the demo admin and sample leads into the configured database:

```powershell
npm run seed
```

The demo sign-in is **admin@demo.com** / **password123**. Change the demo password immediately and never use these credentials on a public or production installation. Run the seeder only against a database where you are comfortable adding demo records.

To start with an empty database instead, skip the seeder and create the first Super Admin from `http://localhost:5173/portal/setup`. The setup page is available only when no document with the `admin` role exists. Removing the final admin re-opens initial setup; employee accounts alone do not lock it. Once an admin exists, both setup and public registration APIs return `403`. Employees are created by an authenticated admin from the Team area.

### 6. Start the application

From the project root:

```powershell
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite forwards `/api` requests over IPv4 to `http://127.0.0.1:4000`. The Express API uses `PORT` (default `4000`); the API health endpoint is [http://127.0.0.1:4000/api/health](http://127.0.0.1:4000/api/health).

To run the two processes separately, use two terminals:

```powershell
npm run dev:server
npm run dev:client
```

## Production build

Build the frontend and run the API from the project root:

```powershell
npm run build
npm run start --workspace server
```

The static frontend files are written to `client/dist`. Publish that directory using a static host with SPA route fallback enabled, or serve it behind your own reverse proxy. The API and frontend may be deployed as separate services; configure the API origin and CORS as described below.

## Deployment

### Backend on Render or Railway

Create a Node web service from the project repository and keep the repository root as the service root so npm workspaces are available.

1. **Build/install command:** `npm install` (or the provider's standard npm install step).
2. **Start command:** `npm run start --workspace server`.
3. **Health check:** `/api/health`.
4. Configure service variables: `NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, and, if needed, `CORS_ORIGINS`, `GROQ_API_KEY`, SMTP settings, and `WEBHOOK_SECRET`.
5. Let the host provide `PORT` where supported. The application honors that value and otherwise defaults to `4000`.
6. In Atlas **Network Access**, allow the hosting provider's outbound IP addresses. If the provider does not offer stable outbound IPs, review its recommended secure connectivity option; avoid leaving Atlas open to every IP longer than necessary.

The API process starts before MongoDB is ready and retries its database connection. During connection, setup-status checks return HTTP `503` with a neutral database-connecting response. The health endpoint confirms process availability, not database readiness.

### Frontend on Vercel

Create a Vercel project for the repository and configure the frontend build:

1. Set the **Root Directory** to `client` (or use the repository root with the equivalent client build and output settings).
2. Build command: `npm run build`; output directory: `dist`.
3. Set the build-time variable `VITE_API_URL=https://<your-api-host>/api`.
4. Set the API's `CLIENT_URL` to the exact public frontend origin. Add any additional approved origins to `CORS_ORIGINS` as a comma-separated list.
5. Enable an SPA fallback to `/index.html` for frontend routes such as `/portal/login` and `/app/leads`.

For refresh-cookie authentication, prefer custom domains on the same site, such as `app.example.com` and `api.example.com`, and use HTTPS on both. The application uses an `httpOnly`, `SameSite=Strict` refresh cookie; unrelated default domains such as `*.vercel.app` and `*.onrender.com` are cross-site and may prevent that cookie from being sent. Never loosen cookie or CORS protections just to mask a deployment-origin mismatch.

Frontend variables are public at build time. Put Groq, MongoDB, SMTP, JWT, and webhook secrets only in the backend service environment.

For additional environment and provider notes, see [docs/deployment.md](docs/deployment.md).

## Troubleshooting and FAQ

### The frontend shows a proxy or connection error

Confirm the API starts on `PORT=4000` (or the host-provided `PORT`) and responds at `/api/health`. Locally, Vite proxies to `http://127.0.0.1:4000`; restart both processes after changing configuration. Setup status retries brief backend/database wake-ups without showing a technical banner.

### MongoDB Atlas refuses the connection

- Confirm the username, password, cluster hostname, and database name in `MONGO_URI`.
- URL-encode special characters in the database password.
- Add your local IP for development and the API host's permitted egress IPs for production under Atlas **Network Access**.
- Confirm the database user has read/write permissions for the selected database.
- Check the API host logs for the MongoDB connection error.

### Groq qualification is unavailable

Set a valid `GROQ_API_KEY` in the **backend** environment and restart/redeploy the API. Confirm the key is active and the account can access the configured model. Lead intake remains available using the fallback qualifier when the AI provider is not configured.

### Browser requests fail with CORS or cookies

Set `CLIENT_URL` to the exact frontend origin, including `https://` and without an extra path. For multiple explicitly trusted frontends, add them to `CORS_ORIGINS`, comma-separated. Keep credentials enabled, use HTTPS in production, and deploy frontend/API on the same site for the strict refresh cookie.

### I cannot create an administrator

If an admin already exists, initial setup is deliberately locked. Sign in as that admin and create employee accounts from the Team area. If the final admin was intentionally removed from MongoDB, reload `/portal/setup`; an employee record alone does not lock initial setup. The status endpoint responds with `503` while MongoDB is connecting.

### Where are the detailed guides?

- [Installation](docs/installation.md)
- [Environment variables](docs/environment.md)
- [Authentication and setup lifecycle](docs/authentication.md)
- [REST API](docs/api.md)
- [Deployment](docs/deployment.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Groq AI setup](docs/ai-setup.md)
- [MongoDB and data](docs/database.md)
- [n8n workflows](docs/n8n-setup.md)

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install both workspace packages |
| `npm run dev` | Start the client and API for development |
| `npm run seed` | Create the demo admin and sample leads |
| `npm run build` | Build the production frontend |
| `npm test` | Run backend tests |
| `npm run lint` | Run client and server lint checks |
| `npm run start --workspace server` | Start the production API |

Mongo-backed lifecycle tests are opt-in and require `MONGO_TEST_URI` to point to a dedicated disposable database. The tests delete records from that database. Review [docs/installation.md](docs/installation.md#tests) before running them.

## License and support

See [LICENSE](LICENSE) for the software license. Review the license and your marketplace terms before redistributing modified copies. Configure and test the product in your own infrastructure before launch.
