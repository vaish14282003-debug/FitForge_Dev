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

- **Workout logging** (step 2): members start today's workout, log weight and reps per set with
  "last time" hints and a rest timer (progress survives a refresh), then get a completion screen.
  The API works out duration, volume, personal records, streaks and the next day in the plan.
  Trainers review client workouts from their dashboard; members see the feedback in History.
- **Join codes**: owners can replace the gym's join code; the old one stops working.

- **Progress** (step 3): members log weigh-ins, body fat and measurements and set a weight goal;
  charts show body weight against the goal, strength per exercise (estimated 1-rep max or heaviest
  set) and weekly volume, each with a table view. Trainers and owners open a client's progress
  read-only from their dashboard or the Team page.

- **Attendance** (step 4): the Front desk page (owners, staff) shows a QR code that changes every
  minute; members scan it with their phone camera and are checked in (logging in first if needed,
  then returned to the check-in). Staff can also check members in by hand. Members see visits on
  their dashboard and a 12-week calendar on Progress; owners see today's count and a 14-day chart.

- **Memberships** (step 5): owners set plans and prices; owners and front-desk staff sell and renew
  memberships (renewals continue the day after the current one ends), record payments (UPI, cash,
  card, bank) or leave them pending, and cancel. The Memberships page lists every member by status
  (expiring, expired, no membership, payment due). Owners see monthly revenue and a 6-month chart;
  members see their membership and a reminder when it's about to end.

- **Profiles and uploads** (step 6): everyone has a profile page (photo, phone, and for members
  height, date of birth and goal; for trainers a bio) and can change their password, which signs out
  other devices. Photos appear across the app. Gyms can add photos to their own exercises. Uploads
  are checked to be real images, resized and saved as WebP, and only served to people in the same gym.

- **Scheduling** (step 7): trainers set weekly hours and session length; members book open slots
  with their trainer (double-booking is blocked by a database index), trainers book for clients and
  mark sessions done or no-show. Trainers and owners create group classes (optionally weekly) with a
  capacity; members join and leave. Members see "Up next" on their dashboard; trainers see today's
  sessions.

- **Notifications** (step 8): a bell with unread count for everyone. Alerts for plans assigned,
  workout feedback, sessions booked or cancelled, classes cancelled, memberships added or ending
  soon, announcements and trainer messages. Owners post announcements to everyone, members, trainers
  or staff; trainers message their clients.
- **Team management**: owners (and staff, for members) edit people and deactivate or reactivate
  accounts. Deactivating signs them out everywhere; a deactivated trainer's clients are unassigned.
- **Welcome tour**: new users get a short guided tour of their own navigation (per role, desktop and
  phone), shown once and remembered on their account; replay it from Profile.
- **Password reset**: "Forgot password?" emails a single-use link valid for 30 minutes, sent through
  Resend (`RESEND_API_KEY`) or SMTP (`SMTP_URL`). Without either (development) the email, link
  included, is printed in the API log.
- **Trainer tools**: private notes on each client, and shared files (PDF or image, up to 10 MB)
  that clients find on their Workouts page.
- **Nutrition**: members set calorie, macro and water goals and log meals and water by day;
  trainers see a 7-day summary on the client page.
- **Reports**: owners download members, payments and attendance as CSV and see trainer performance.

### Muscle Intelligence (3D)

`/muscle-intelligence` (members and trainers) shows a rotatable 3D muscular figure. Tap a muscle to see
what it does and which exercises train it as a prime mover (primary) or an assistant (secondary); pick
an exercise to light up its muscles. Code lives in `frontend/src/features/muscle-intelligence/`.

- **Data:** 24 stable muscle IDs (`backend/src/config/anatomy.js`) on every library exercise as
  `primaryMuscles` / `secondaryMuscles` / `movementPattern`. A Vitest test keeps the frontend catalog
  in sync with the backend. `GET /api/exercises?muscle=<id>` filters by muscle.
- **Model:** `frontend/public/models/anatomy.glb`, derived from **BodyParts3D, © The Database Center for Life
  Science, CC BY 4.0** (see `public/models/ATTRIBUTION.md`, including a note on the older CC BY-SA notice in
  the source files). Real anatomy: 22 of the 24 muscles as their own meshes (left and right), plus context
  muscles and the skeleton. BP3D 4.0 has no latissimus dorsi or rectus abdominis; the page says so and those
  still work from the list. Muscle-to-mesh mapping is reviewed by hand in `scripts/anatomy/bp3d-mapping.json`;
  rebuild with `npm run build:anatomy-model -- <bodyparts3d data dir>` (steps at the top of the script).
  The earlier stylized figure (`anatomy/procedural-body.ts`) remains only as a fallback if the model fails to load.
- **Performance:** three.js loads only on this page (~275 KB gzipped of code plus the 1.9 MB meshopt-compressed
  model, ~270k triangles), renders on demand
  rather than every frame, and caps device pixel ratio at 1.75. Without WebGL the page keeps a text
  muscle list and links to the 2D explorer (`/muscle-explorer`).

### File storage

Uploads go to `backend/uploads/` by default. To use S3 instead, set in `backend/.env`:

```
STORAGE_DRIVER=s3
AWS_REGION=ap-south-1
AWS_S3_BUCKET=your-bucket
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

The bucket stays private: the API checks the viewer's gym and redirects to a 5-minute signed link.
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
npm run seed:memberships      # adds plans, demo members and 6 months of membership sales (non-destructive)
npm run seed:schedule         # adds trainer hours, demo sessions and 3 weeks of classes (non-destructive)
npm run seed:progress         # adds ~8 weeks of demo workouts, weigh-ins and check-ins for member@fitforge.dev (non-destructive)
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
cd backend && npm test        # API: 115 tests against an in-memory MongoDB
cd frontend && npm test       # website unit tests (Vitest)
cd frontend && npm run test:e2e   # browser tests (Playwright) against a running site
```

End-to-end tests read `E2E_BASE_URL` (default `http://localhost:3001`) and only create data when
`E2E_ALLOW_WRITES=1`, so by default they're safe against your development database. They log in
many times, so the API's login limit (`AUTH_RATE_LIMIT`, 20 per 15 minutes) may need raising for a
local run. CI (`.github/workflows/ci.yml`) runs everything on every push, including the browser
tests against the production Docker images and a throwaway database.

## Deploying

See [DEPLOY.md](DEPLOY.md): Atlas + Render (API, `render.yaml`) + Vercel (website), with S3 for
uploads, Resend (or SMTP) for email and optional Sentry error tracking. In production the API refuses
to start with a placeholder login secret or a non-https site address, and demo `@fitforge.dev`
accounts cannot sign in. `docker compose --profile full up --build` runs the whole stack locally.

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
| POST | `/api/gym/join-code` | `gym:settings` (replaces the join code) |
| POST | `/api/sessions` | `workout:log` (members) |
| GET | `/api/sessions/summary`, `/api/sessions/previous` | `workout:log` |
| GET | `/api/sessions`, `/api/sessions/:id` | Members: own; trainers: their clients; owners: the gym |
| PATCH | `/api/sessions/:id/review` | `clients:read:assigned` |
| GET | `/api/progress/metrics`, `/training`, `/strength` | Members: own; trainers/owners: `?member=` in scope |
| PUT, DELETE | `/api/progress/metrics`, `/api/progress/goal` | `workout:log` (members, own data) |
| GET | `/api/attendance/qr`, `/api/attendance/stats` | `members:manage` (front desk) |
| POST | `/api/attendance/check-in` | `workout:log` (scanned QR token, valid 2 min) |
| POST | `/api/attendance` | `members:manage` (manual check-in) |
| GET | `/api/attendance/summary` | Members: own; trainers: clients; owners/staff: gym |
| GET | `/api/membership-plans` | Signed in (members see plans on sale) |
| POST, PATCH | `/api/membership-plans` | `gym:settings` (owners set prices) |
| GET | `/api/memberships`, `/roster`, `/overview` | `memberships:manage` (revenue in overview needs `revenue:read`) |
| POST | `/api/memberships`, `/:id/renew`, `/:id/cancel` | `memberships:manage` |
| PATCH | `/api/memberships/:id/payment` | `memberships:manage` |
| GET | `/api/memberships/me` | `workout:log` (members) |
| POST, DELETE | `/api/users/me/avatar` | Signed in (own photo) |
| POST | `/api/users/me/password` | Signed in |
| POST | `/api/exercises/:id/image` | `workout:create` (gym's own exercises) |
| GET | `/api/files/*` | Signed in, same gym as the file |
| GET, PUT | `/api/schedule/availability` | Read: members/trainers/owners; write: trainers (own hours) |
| GET | `/api/schedule/slots`, `/api/schedule/bookings` | Members: own trainer/own; trainers: own; owners: gym |
| POST | `/api/schedule/bookings`, `/:id/cancel` | Members (own trainer) and trainers (own clients) |
| PATCH | `/api/schedule/bookings/:id/status` | `workout:create` |
| GET | `/api/schedule/classes` | Signed in |
| POST | `/api/schedule/classes`, `/:id/cancel` | `workout:create` |
| POST | `/api/schedule/classes/:id/join`, `/leave` | `workout:log` (members) |

## Tech stack: what each piece does here

**Frontend** (`frontend/`)

| Tool | Its job in FitForge |
| --- | --- |
| Next.js 16 (App Router) | Pages and routing. Each folder in `src/app` is a URL. `src/proxy.ts` sends signed-out visitors to `/login`, and `next.config.ts` forwards `/api/*` to the Express API so cookies stay first-party. |
| TypeScript | Types for every API response (`src/lib/types.ts`), so mistakes show up in the editor. |
| Tailwind CSS 4 | All styling. Theme colours and fonts are tokens in `src/app/globals.css`. |
| TanStack Query | Fetches and caches API data (`src/hooks/use-*.ts`) and refreshes lists after a save. |
| React Hook Form + Zod | Forms and their validation (login, register, add exercise, add team member). |
| Recharts | The progress charts (body weight, strength, weekly volume) in `src/components/progress/charts.tsx`. |
| Framer Motion | Page fades, card fade-ups, drag-to-reorder, the rest timer, the workout-complete celebration. |
| Lucide | Icons. |
| qrcode | Draws the front-desk check-in QR code as SVG. |
| next/font | Fraunces (headings) and Plus Jakarta Sans (body), self-hosted at build time. |

**Backend** (`backend/`)

| Tool | Its job in FitForge |
| --- | --- |
| Express 5 | The HTTP API. `src/routes` maps URLs to `src/controllers`. |
| MongoDB + Mongoose | Database and models (`src/models`): User, Gym, RefreshToken, Exercise, WorkoutPlan, WorkoutSession, BodyMetric, Attendance, MembershipPlan, Membership, Availability, Booking, GymClass. |
| JWT + bcrypt | Login sessions (`src/utils/tokens.js`) and password hashing. |
| Joi | Validates every request body and query (`src/validators`). |
| RBAC map | `src/config/roles.js` says which role has which permission; `authorize()` checks it per route. |
| Helmet, CORS, rate limiting | Security headers, cross-origin rules, and slowing down password guessing. |
| Winston | Logging. |
| Multer + sharp | Receive uploads and turn them into resized, metadata-free WebP images. |
| AWS SDK (S3) | Stores files in S3 and creates signed links when `STORAGE_DRIVER=s3`. |
| Swagger UI | Live API docs at `/api/docs`, from `src/docs/openapi.js`. |
| Jest + Supertest + mongodb-memory-server | Tests that call the real API against a throwaway in-memory database. |

**Tooling**: Docker Compose runs MongoDB locally; git tracks history.

