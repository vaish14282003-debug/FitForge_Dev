# Deploying FitForge

Three pieces, each on a free or cheap tier:

| Piece | Where | Why |
| --- | --- | --- |
| Database | MongoDB Atlas | Already in use. |
| API (`backend/`) | Render (Docker) | `render.yaml` describes it. |
| Website (`frontend/`) | Vercel | Built for Next.js. Forwards `/api/*` to the API, so login cookies stay first-party. |
| Uploads | AWS S3 | Render's disk is wiped on every deploy. |
| Email | Any SMTP provider (Brevo, Mailgun, Amazon SES, Gmail app password) | Password reset links. |

## Before the first deploy

1. **Push to GitHub.** Render and Vercel deploy from a repository.
2. **Atlas:** create a separate database user for production with a strong password. Under
   **Network Access**, Render's outbound IPs change, so either allow `0.0.0.0/0` (protected by the
   user/password) or upgrade Render and allow its static IPs.
3. **S3:** create a private bucket (Block all public access: on) in `ap-south-1`, and an IAM user
   limited to `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on that bucket.
4. **Never run `npm run seed` against production.** It wipes everything and creates demo accounts
   with the public password `Password123!`. It refuses remote databases unless given `--yes`, and
   refuses `NODE_ENV=production` outright.

## 1. API on Render

1. Render dashboard → **New → Blueprint** → pick the repository. It reads `render.yaml`.
2. Fill in the values marked `sync: false`:
   - `MONGO_URI`: the Atlas connection string, ending in `/fitforge`.
   - `CLIENT_ORIGIN` and `APP_URL`: the website address, e.g. `https://fitforge.vercel.app`.
     (Deploy the website first, or use a guess and update both later.)
   - `SMTP_URL`: e.g. `smtps://user:password@smtp-relay.brevo.com:465`.
   - `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.
3. `JWT_ACCESS_SECRET` is generated for you. Changing it later signs everyone out.
4. When it's live, `https://<your-api>.onrender.com/api/health` returns `{"status":"ok"}`.

## 2. Website on Vercel

1. Vercel → **Add New → Project** → the repository. Set **Root Directory** to `frontend`.
2. Environment variables (used at build time, so redeploy after changing them):
   - `API_URL` = `https://<your-api>.onrender.com`
   - `NEXT_PUBLIC_APP_URL` = the website's own address (the front-desk QR code uses it).
   - `NEXT_PUBLIC_HERO_VIDEO_URL` (optional) = a landing video you own, e.g. `/hero.mp4`.
3. Deploy, then set `CLIENT_ORIGIN` and `APP_URL` on Render to the final website address.

## 3. First login

Production starts empty. Open the website, **Get started → I own a gym**, and create the real owner
account. Add trainers and staff from **Team**; members join with the gym code or are added there.

## Checklist

- [ ] `/api/health` is OK through the website: `https://<site>/api/health`.
- [ ] Sign up, log out, log in. Cookies are `Secure` and `HttpOnly` (browser devtools → Application).
- [ ] Forgot password sends a real email, and the link opens the website.
- [ ] Upload a profile photo; it survives a Render redeploy (it's in S3).
- [ ] Front desk QR code shows the website address, and scanning it on a phone checks in.
- [ ] Atlas: production user is not the one used for development.

## Running the whole stack in Docker

```bash
JWT_ACCESS_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))") \
  docker compose --profile full up --build
```

The website is on http://localhost:3000 (set `WEB_PORT` for another port) with its own MongoDB.
Uploads go to a Docker volume.

## Settings reference (API)

| Variable | Required | Notes |
| --- | --- | --- |
| `MONGO_URI` | yes | |
| `JWT_ACCESS_SECRET` | yes | 32+ characters. |
| `APP_URL` | in production | Website address for emailed links. |
| `CLIENT_ORIGIN` | | Website address (CORS). |
| `SMTP_URL`, `MAIL_FROM` | for email | Without SMTP, production can't send reset emails. |
| `STORAGE_DRIVER` | | `local` (default) or `s3`, plus `AWS_*`. |
| `TRUST_PROXY` | | Proxies in front: `1` locally, `2` for Vercel → Render. |
| `AUTH_RATE_LIMIT` | | Login/sign-up attempts per IP per 15 min (default 20). |
