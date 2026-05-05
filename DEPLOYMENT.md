# Deployment Guide — Render + Netlify

Deploy AGENTFORGE for free in ~20 minutes:
- **Backend (FastAPI)** → Render.com
- **Frontend (React)** → Netlify

---

## Step 0 — Push to GitHub

```bash
cd agentforge
git init
git add .
git commit -m "initial commit"
```

Create an empty repo on github.com (name it `agentforge`, keep it Public for free tier), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/agentforge.git
git branch -M main
git push -u origin main
```

> If push asks for password: GitHub no longer accepts account passwords. Create a Personal Access Token at github.com → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token → check `repo` scope. Use that token as the password.

---

## Step 1 — Deploy backend to Render

### 1a. Create the service
1. Go to [render.com](https://render.com) → **Sign up with GitHub**
2. Click **+ New** → **Web Service** → connect your `agentforge` repo

### 1b. Configure
| Field | Value |
|---|---|
| **Name** | `agentforge-backend` |
| **Region** | Closest to you (Singapore for India) |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| **Instance Type** | **Free** |

### 1c. Environment variables
Scroll to **Environment Variables** and add:

| Key | Value |
|---|---|
| `GROQ_API_KEY` | `gsk_...` (your real Groq key from console.groq.com/keys) |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` |
| `ALLOWED_ORIGINS` | `*` (we'll tighten in Step 3) |

### 1d. Deploy
Click **Create Web Service**. Wait ~6-9 min for first build (CrewAI and AutoGen pull substantial dependency trees — first install is slow, subsequent deploys are fast since Render caches packages). When you see `Uvicorn running on http://0.0.0.0:10000` in the logs, it's live.

**Copy your backend URL** from the top of the page, e.g. `https://agentforge-backend.onrender.com`.

### 1e. Test it
```
https://agentforge-backend.onrender.com/
```
Should return JSON with `"service": "AGENTFORGE"`. The `/docs` path gives you the Swagger UI.

> **Free tier note:** Render free instances **sleep after 15 minutes** of inactivity. First request after sleep takes ~30 seconds to wake up. Fine for a portfolio piece.

---

## Step 2 — Deploy frontend to Netlify

### 2a. Create the site
1. Go to [netlify.com](https://netlify.com) → **Sign up with GitHub**
2. **Add new site** → **Import an existing project** → **GitHub** → pick `agentforge`

### 2b. Configure
Netlify auto-detects from `netlify.toml`, so verify:
| Field | Value |
|---|---|
| **Base directory** | `frontend` |
| **Build command** | `npm run build` |
| **Publish directory** | `frontend/dist` |

### 2c. Environment variable (CRITICAL)
Click **Add environment variables** before deploying (or under Site settings → Environment variables):

| Key | Value |
|---|---|
| `VITE_API_BASE` | `https://agentforge-backend.onrender.com` |

> Use **your** Render URL from Step 1d. **No trailing slash.**

### 2d. Deploy
Click **Deploy site**. Build takes ~1-2 minutes. You'll get a URL like `https://lucky-name-12345.netlify.app`.

Rename it: **Site settings → Change site name** → `agentforge` (if available) → save. New URL: `https://agentforge.netlify.app`.

---

## Step 3 — Lock down CORS

Now that you have your Netlify URL:
1. Render dashboard → your service → **Environment**
2. Edit `ALLOWED_ORIGINS` to your Netlify URL: `https://agentforge.netlify.app`
3. Save → Render auto-redeploys (~1 min)

---

## Step 4 — Verify

1. Open your Netlify URL
2. Header should show **BACKEND** with green dot
3. Click any template card (e.g. "Market Analysis") → click **EXECUTE CREW**
4. You should see ATLAS plan, ORION research, VEGA synthesize — all live

Done. Share the Netlify URL on your resume / LinkedIn.

---

## Troubleshooting

**"Connection failed" / Backend dot is red**
- Render free tier sleeps after 15 min — first request takes ~30s to wake. Wait and retry.
- Check `VITE_API_BASE` is set on Netlify (no trailing slash, includes `https://`).
- DevTools → Console → if CORS errors, set `ALLOWED_ORIGINS=*` on Render temporarily and verify.

**Build fails on Netlify with "command not found"**
- Site settings → Build & deploy → confirm base directory is `frontend`.

**Build fails on Render with "ModuleNotFoundError"**
- Check Root Directory is `backend` (not blank, not `/`).

**"GROQ_API_KEY not configured" error**
- Render dashboard → Environment → confirm key was saved (starts with `gsk_`).

**Workflow runs but never completes**
- Check Render logs for `Groq API error` — your key may be invalid or rate-limited (free Groq tier has limits).

---

## Updates

Every `git push` to `main` auto-deploys both sides:
- Render rebuilds backend (~3 min)
- Netlify rebuilds frontend (~1 min)

```bash
git add .
git commit -m "feature: ..."
git push
```

---

## Final URLs to share

- **Live demo:** `https://agentforge.netlify.app`
- **API docs:** `https://agentforge-backend.onrender.com/docs`
- **Source:** `https://github.com/YOUR_USERNAME/agentforge`
