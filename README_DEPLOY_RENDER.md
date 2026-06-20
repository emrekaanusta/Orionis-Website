Deploying the Express backend to Render (recommended)

1) Create a new Web Service on Render:
   - Go to https://render.com -> New -> Web Service
   - Connect your GitHub account and pick this repo and the `main` branch
   - Use the following settings:
     - Environment: `Node`
     - Build Command: `npm install`
     - Start Command: `node server/server.js`
     - Region: choose nearest
   - Add environment variables (Render -> Environment -> Add): copy the values from your local `.env` (DO NOT commit secrets to git):
     - `ADMIN_USER`, `ADMIN_PASS`, `ADMIN_SECRET`, `FROM_EMAIL`, `ADMIN_EMAIL`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `MAILGUN_API_KEY`, `MAILGUN_DOMAIN` (as needed)

2) Deploy the service. After it finishes, you'll have a public URL like `https://orionis-backend.onrender.com`.

3) Point frontend to backend:
   - In Vercel, set an environment variable `API_BASE` to your backend URL (e.g. `https://orionis-backend.onrender.com`) for the Production environment.
   - Or edit `index.html`/`admin.html` to include a script tag before other scripts:
     <script>window.API_BASE = 'https://orionis-backend.onrender.com';</script>

4) Redeploy your frontend on Vercel (Dashboard -> Redeploy) so it picks up the `API_BASE` env var, or push the change.

Notes
- Uploaded images are stored in `uploads/` on the backend server. If you deploy multiple instances or redeploy frequently, consider using S3 or other object storage instead.
- Render free tier can sleep; for production consider a paid plan or Railway.
