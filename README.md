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
- **Workouts** (step 1 of the roadmap): a built-in library of 30 exercises plus each gym's own;
  a plan builder (days, exercises with sets/reps/weight/rest, drag to reorder) for trainers and
  owners; assigning plans to clients; members see their plan and today's workout.

Logging workouts, progress, attendance, memberships, scheduling and uploads are not built yet.
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
npm run seed                  # optional: demo gym, one account per role, a sample plan (wipes the DB)
npm run seed:exercises        # adds/updates the built-in exercise library without touching other data
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
| GET | `/api/gym/lookup?code=` | Public (returns only the gym name) |
| GET | `/api/exercises` | Signed in |
| POST | `/api/exercises` | `workout:create` |
| GET | `/api/plans`, `/api/plans/:id` | Signed in (owners: all; trainers: their own; members: assigned to them) |
| POST, PUT, DELETE | `/api/plans`, `/api/plans/:id` | `workout:create` (trainers edit their own) |
| PUT | `/api/plans/:id/assignees` | `workout:assign` (trainers: their own clients only) |

## Tech stack: what each piece does here

**Frontend** (`frontend/`)

| Tool | Its job in FitForge |
| --- | --- |
| Next.js 16 (App Router) | Pages and routing. Each folder in `src/app` is a URL. `src/proxy.ts` sends signed-out visitors to `/login`, and `next.config.ts` forwards `/api/*` to the Express API so cookies stay first-party. |
| TypeScript | Types for every API response (`src/lib/types.ts`), so mistakes show up in the editor. |
| Tailwind CSS 4 | All styling. Theme colours and fonts are tokens in `src/app/globals.css`. |
| TanStack Query | Fetches and caches API data (`src/hooks/use-*.ts`) and refreshes lists after a save. |
| React Hook Form + Zod | Forms and their validation (login, register, add exercise, add team member). |
| Framer Motion | Card fade-ups, the drag-to-reorder exercise list, expanding rows. |
| Lucide | Icons. |
| next/font | Fraunces (headings) and Plus Jakarta Sans (body), self-hosted at build time. |

**Backend** (`backend/`)

| Tool | Its job in FitForge |
| --- | --- |
| Express 5 | The HTTP API. `src/routes` maps URLs to `src/controllers`. |
| MongoDB + Mongoose | Database and models (`src/models`): User, Gym, RefreshToken, Exercise, WorkoutPlan. |
| JWT + bcrypt | Login sessions (`src/utils/tokens.js`) and password hashing. |
| Joi | Validates every request body and query (`src/validators`). |
| RBAC map | `src/config/roles.js` says which role has which permission; `authorize()` checks it per route. |
| Helmet, CORS, rate limiting | Security headers, cross-origin rules, and slowing down password guessing. |
| Winston | Logging. |
| Swagger UI | Live API docs at `/api/docs`, from `src/docs/openapi.js`. |
| Jest + Supertest + mongodb-memory-server | Tests that call the real API against a throwaway in-memory database. |

**Tooling**: Docker Compose runs MongoDB locally; git tracks history.

