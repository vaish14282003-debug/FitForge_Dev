# FitForge

Fitness tracking and gym management for members, trainers and gym owners.

## What exists so far

- **Auth**: register, login, logout, session refresh. JWT access token (15 min) and a rotating,
  single-use refresh token (7 days), both in httpOnly cookies.
- **Roles and permissions**: `GYM_OWNER`, `TRAINER`, `STAFF`, `MEMBER` (`SUPER_ADMIN` is defined but has no screens).
  Routes check permissions, not role names; the map lives in `backend/src/config/roles.js`.
- **Gyms as tenants**: every account belongs to one gym and only ever sees that gym's data.
- **Web app**: landing page, login, register, a dashboard per role, and a Team page for adding
  people and assigning trainers to members.

Workouts, progress, attendance, memberships, scheduling and uploads are not built yet.
Dashboard cards for those say "Coming soon".

### How people get accounts

| Role | How |
| --- | --- |
| Owner | Signs up and names their gym. The gym gets an 8-character join code. |
| Member | Signs up with the gym's join code, or is added from the Team page. |
| Trainer, Staff | Added by the owner from the Team page. They cannot self-register. |

## Run it locally

Needs Node 20+ and Docker.

```bash
docker compose up -d          # MongoDB on localhost:27017

cd backend
cp .env.example .env          # then set JWT_ACCESS_SECRET (command is in the file)
npm install
npm run seed                  # optional: demo gym with one account per role
npm run dev                   # API on http://localhost:4000

cd ../frontend
npm install
npm run dev                   # web app on http://localhost:3000
```

The seed prints the demo logins (`owner@`, `trainer@`, `staff@`, `member@fitforge.dev`). It wipes the database first.

The browser only talks to the Next.js origin; `/api/*` is forwarded to the API (`API_URL`, see
`frontend/.env.example`). That keeps the auth cookies first-party.

## Tests

```bash
cd backend && npm test
```

Runs against an in-memory MongoDB (downloaded once, on the first run). The test script sets
`--experimental-vm-modules` because the MongoDB driver uses a dynamic `import()` that Jest
otherwise cannot resolve.

## API

Interactive docs (Swagger UI) are at http://localhost:3001/api/docs (or http://localhost:4000/api/docs
straight against the API); the raw OpenAPI spec is at `/api/docs.json`. To call protected endpoints there,
run `POST /auth/login` first: the session cookie it sets is sent with every later request on the page.
`tests/docs.test.js` fails if a route is added without documenting it in `backend/src/docs/openapi.js`.


| Method | Path | Who |
| --- | --- | --- |
| POST | `/api/auth/register` | Public (owner or member only) |
| POST | `/api/auth/login`, `/refresh`, `/logout` | Public |
| GET | `/api/auth/me` | Signed in |
| PATCH | `/api/users/me` | Signed in |
| GET | `/api/users?role=` | `members:manage` and/or `trainers:manage` |
| POST | `/api/users` | Same, depending on the role being created |
| GET | `/api/users/clients` | `clients:read:assigned` |
| PATCH | `/api/users/:id/trainer` | `members:manage` |
| GET | `/api/gym` | Signed in (join code only with `gym:settings`) |
| GET | `/api/gym/overview` | `members:manage` + `trainers:manage` |
