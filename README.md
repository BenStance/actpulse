# ACTPulse

ACTPulse is an IoT monitoring platform for tracking generator and UPS state in real time. It combines:

- a NestJS backend with PostgreSQL, TypeORM, JWT auth, and Socket.IO
- a React + Vite frontend for admin and controller dashboards
- an ESP32 workflow that sends device status and heartbeat updates to the backend

The app supports user activation, device management, realtime status updates, uptime and downtime analytics, and downloadable reports.

## Features

- Real-time generator and UPS monitoring
- Role-based access for platform Admin and customer Controller accounts
- Organizations isolate customer devices, Controllers, dashboards, reports and realtime events
- Site and Generator/UPS profiles, Controller equipment assignments, monitor onboarding, key rotation, replacement, and retirement
- ESP32 sensor status and heartbeat ingestion using API keys
- Dashboard metrics, connectivity history, observed ON/OFF/unknown duration charts, and activity timelines
- Report views for device uptime, daily summaries, event history, and fleet summaries
- Password reset and account activation flows through email OTPs

## Project Structure

```text
ACTPulse/
  backend/   NestJS API, TypeORM entities, migrations, and ESP32 endpoints
  frontend/  React dashboard, landing page, auth flows, and admin/controller UI
  *.pdf, *.docx  Project documentation and design files
```

## Tech Stack

- Backend: NestJS, TypeScript, PostgreSQL, TypeORM, Bearer JWT, Socket.IO, Nodemailer
- Frontend: React 19, Vite, React Router, Axios, Tailwind CSS, Framer Motion, Recharts, Zustand
- Hardware: ESP32 with HTTP polling and heartbeat/status reporting

## Prerequisites

- Node.js 20+ recommended
- npm
- PostgreSQL database
- An email service account for password reset and invitation emails
- An ESP32 device if you want to test the hardware integration

## Backend Setup

1. Open the backend folder:

```bash
cd backend
```

2. Install dependencies:

```bash
npm install
```

3. Copy `backend/.env.example` to an untracked `backend/.env` and replace the placeholders. Use a JWT signing secret of at least 32 UTF-8 bytes:

```env
PORT=3000
JWT_SECRET=<long-random-secret>

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=<postgres-password>
DB_NAME=actpulse
DB_SYNCHRONIZE=false
DB_LOGGING=false
EMAIL_HOST=<smtp-host>
EMAIL_PORT=587
EMAIL_USER=<smtp-user>
EMAIL_PASSWORD=<smtp-password>
```

4. Apply migrations, then explicitly create the first Admin if one does not exist:

```bash
npm run migration:run
# Set BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD
npm run admin:bootstrap
```

The bootstrap command leaves an existing Admin unchanged.

5. Start the server:

```bash
npm run start:dev
```

The backend runs on `http://localhost:3000` by default.

### Backend Scripts

- `npm run start:dev` - run the API in watch mode
- `npm run build` - compile to `dist/`
- `npm run start:prod` - run the compiled server
- `npm run test` - run unit tests
- `npm run test:e2e` - run end-to-end tests
- `npm run migration:generate` - generate a new TypeORM migration
- `npm run migration:run` - run pending migrations
- `npm run migration:revert` - revert the last migration
- `npm run admin:bootstrap` - create the initial Admin explicitly

## Frontend Setup

1. Open the frontend folder:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Optionally set the backend URL in a `.env` file:

```env
VITE_API_BASE_URL=http://localhost:3000
```

4. Start the app:

```bash
npm run dev
```

The frontend runs on `http://localhost:5173` by default.

### Frontend Scripts

- `npm run dev` - start the Vite dev server
- `npm run build` - create a production build
- `npm run preview` - preview the production build
- `npm run lint` - run ESLint

## Main Modules

### Backend

- `auth` - login, logout, forgot password, reset password, and change password
- `users` - Controller invitation, activation, management, and equipment assignment
- `organizations` - Admin customer management and Controller organization summary
- `sites` and `equipment` - customer locations, Generator/UPS profiles, and assignment management
- `devices` - Admin monitor registration, binding, replacement, and key rotation; assigned Controller read access
- `monitoring` - persistent connectivity, access scoping, and observed duration calculations
- `sensors` - ESP32 status and heartbeat ingestion through API key auth
- `dashboard` - summary, uptime, downtime, and activity data
- `reports` - device and fleet reporting endpoints
- `realtime` - Socket.IO gateway for live device events
- `mail` - invitation and password reset emails

### Frontend

- Public pages: landing, login, forgot password, reset password, activate account
- Admin area: dashboard, organizations, sites, equipment, users, monitors, reports, device-key settings, profile, account security
- Controller area: dashboard, assigned sites and equipment, monitor details, reports, profile, account security

## API Overview

The frontend consumes the backend through `VITE_API_BASE_URL` or `http://localhost:3000` by default.

Common endpoint groups:

- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/change-password`
- `GET /auth/me` and `PATCH /auth/me`
- `POST /users`
- `POST /users/activate`
- `GET /users`
- `POST /users/:id/resend-invitation`
- `POST /users/:id/reactivate`
- `GET /organizations` and `GET /organizations/me`
- `POST /organizations` and `PATCH /organizations/:id`
- `POST /organizations/:id/activate` and `/deactivate`
- `GET /devices`
- `POST /devices`
- `POST /devices/:id/rotate-key`
- `POST /devices/:id/replace`, `/disable`, and `/retire`
- `GET /sites` and `POST /sites`
- `GET /equipment` and `POST /equipment`
- `GET /equipment/:id/events` and `POST /equipment/:id/controllers`
- `POST /sensors/status`
- `POST /sensors/heartbeat`
- `GET /dashboard/summary`
- `GET /dashboard/uptime`
- `GET /dashboard/downtime`
- `GET /dashboard/activity`
- `GET /reports/device-uptime`
- `GET /reports/device-daily`
- `GET /reports/device-events`
- `GET /reports/fleet-summary`
- `GET /reports/equipment`, `/equipment-events`, and `/fleet.csv`

## Realtime Events

The frontend listens to Socket.IO events for live updates:

- `device.status.updated`
- `device.online`
- `device.offline`
- `operations.updated`
- `alerts.updated`

## ESP32 Integration

The repository includes an example ESP32 sketch in `backend/actpulse.ino`.

Important notes:

- update the Wi-Fi credentials
- set `BACKEND_URL` to your machine IP, not `localhost`
- replace `API_KEY` with the device API key issued by the backend
- the sketch sends status updates and heartbeats to the `/sensors` endpoints

## Database Notes

The backend uses TypeORM with PostgreSQL.

- use migrations for schema changes; keep `DB_SYNCHRONIZE=false`
- existing customer devices and Controller accounts were placed in the Legacy Customer organization by the Phase 02 migration
- the modules 4–8 migration creates sites and equipment, links existing monitors and assignments, preserves sensor history, and hashes legacy API keys
- the modules 9–14 migration creates dedicated generator tanks, operational fuel and service records, alert rules/notifications, and audit history; run `npm run migration:run` from `backend` after reviewing the pending migration
- organizations with device history cannot be deleted

The operational pages are Fuel, Maintenance, Alerts, Notifications and the shared Reports workspace. `GET /reports/operations` and `/reports/operations/export.csv` serve scoped operational reports. See `phase-two-modules-9-14.txt` for endpoints and permissions. During the modules 15–18 work, migrations 1790842000000 and 1790842100000 were applied to the configured application database by a test isolation error; see `phase-two-modules-15-18.txt` for the verified state and safe follow-up.

Subscriptions, manual billing, payment review, platform statistics, audit logs and customer activity are described in `phase-two-modules-15-18.txt`. Configure payment instructions in Platform Billing before collecting transfers. Keep payment proofs in private storage and back up that directory with PostgreSQL.

### Local dashboard demo data

Run `npm run migration:run` and then `npm run demo:seed` from `backend` to add five demo organizations to the configured PostgreSQL database. The seed is additive, creates 30 days of simulated monitor events plus equipment, fuel, maintenance, alerts, invoices and payment reviews, and stops if only part of the demo set exists. It includes active, trialing, expired and time-limited grace subscriptions. A grace subscription keeps operational access until `grace_ends_at`; approval of a paid renewal clears that date.

The generated Controller passwords and demo monitor API keys are in the root `seeded-organization-credentials.txt`. The file is excluded from Git and written with owner-only permissions. Demo payment proofs are illustrative images; the seeded approvals do not represent real transfers. Existing organizations and payment instructions are not changed. Restart a non-watch backend process after applying the migration so it loads the new grace-period code.

Current monitoring reports use observed ON, OFF, and UNKNOWN intervals. A heartbeat confirms connectivity; a status observation confirms equipment state. Legacy profiles require Admin classification before their running hours can be interpreted as engine running time. The ESP32 sketch supplies status and heartbeat input but does not expose fuel level, load, battery health, or utility availability unless separate physical inputs are added.

## Admin provisioning

The backend does not create an Admin at startup. Use `npm run admin:bootstrap` with environment-supplied credentials. Existing Admin accounts are never reset by this command.

## Credential rotation after Phase 02

`backend/.env` is no longer tracked, but earlier commits contain its values. Rotate the PostgreSQL password and SMTP application password in their respective services, then update your local untracked `.env`. The previously hard-coded Admin password should be changed through Account Security. The local JWT signing secret was replaced during Phase 02; any other deployment that used the old signing secret must replace it too. Git history has not been rewritten.

## Documentation

Project reference files are also included in the root:

- `IoT ACTPulse project.pdf`
- `IoT sensor Project.pdf`
- `iot sensor project.docx`

## License

This project is provided as part of the ACTPulse workspace. Add your preferred license here if you plan to distribute it publicly.
