# ACTPulse

ACTPulse is an IoT monitoring platform for tracking generator and UPS state in real time. It combines:

- a NestJS backend with PostgreSQL, TypeORM, JWT auth, and Socket.IO
- a React + Vite frontend for admin and controller dashboards
- an ESP32 workflow that sends device status and heartbeat updates to the backend

The app supports user activation, device management, realtime status updates, uptime and downtime analytics, and downloadable reports.

## Features

- Real-time generator and UPS monitoring
- Role-based access for Admin, Controller, and User accounts
- Device onboarding, key rotation, activation, and deactivation
- ESP32 sensor status and heartbeat ingestion using API keys
- Dashboard metrics, uptime charts, downtime charts, and activity timelines
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

- Backend: NestJS, TypeScript, PostgreSQL, TypeORM, Passport JWT, Socket.IO, Nodemailer
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

3. Configure environment variables in `backend/.env`:

```env
PORT=3000
JWT_SECRET=your_jwt_secret

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=actpulse
DB_SYNCHRONIZE=true
DB_LOGGING=false
```

4. Start the server:

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
- `users` - user creation, activation, updates, deactivation, and device assignment
- `devices` - device CRUD, key rotation, and access control
- `sensors` - ESP32 status and heartbeat ingestion through API key auth
- `dashboard` - summary, uptime, downtime, and activity data
- `reports` - device and fleet reporting endpoints
- `realtime` - Socket.IO gateway for live device events
- `mail` - invitation and password reset emails

### Frontend

- Public pages: landing, login, forgot password, reset password, activate account
- Admin area: dashboard, users, devices, reports, settings
- Controller area: dashboard, assigned devices, device details, reports, settings

## API Overview

The frontend consumes the backend through `VITE_API_BASE_URL` or `http://localhost:3000` by default.

Common endpoint groups:

- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/change-password`
- `POST /users`
- `POST /users/activate`
- `GET /users`
- `GET /devices`
- `POST /devices`
- `POST /devices/:id/rotate-key`
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

## Realtime Events

The frontend listens to Socket.IO events for live updates:

- `device.status.updated`
- `device.online`
- `device.offline`

## ESP32 Integration

The repository includes an example ESP32 sketch in `backend/actpulse.ino`.

Important notes:

- update the Wi-Fi credentials
- set `BACKEND_URL` to your machine IP, not `localhost`
- replace `API_KEY` with the device API key issued by the backend
- the sketch sends status updates and heartbeats to the `/sensors` endpoints

## Database Notes

The backend uses TypeORM with PostgreSQL.

- `DB_SYNCHRONIZE=true` is convenient for local development
- use migrations for controlled schema changes in shared or production environments

## Default Admin

The backend seeds an initial admin account on startup if one does not already exist. Check `backend/src/modules/auth/auth.service.ts` if you need the seeded credentials for local testing.

## Documentation

Project reference files are also included in the root:

- `IoT ACTPulse project.pdf`
- `IoT sensor Project.pdf`
- `iot sensor project.docx`

## License

This project is provided as part of the ACTPulse workspace. Add your preferred license here if you plan to distribute it publicly.
