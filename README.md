# NYC Sidewalk Forum — FULL VERSION (shared database, real accounts, lead capture)

100% free tier: Cloudflare Pages (hosting) + Pages Functions (API) + D1 (database).
All visitors share the same forum. Passwords are hashed (PBKDF2). Leads are saved
to the database and can optionally email you.

=====================================================================
DEPLOY — step by step (one-time setup, ~10 minutes)
=====================================================================

STEP 0 — Requirements
  - Node.js installed
  - Free Cloudflare account (dash.cloudflare.com)

STEP 1 — Install dependencies
  Open a terminal in this folder and run:
    npm install

STEP 2 — Log wrangler into your Cloudflare account
    npx wrangler login
  (a browser window opens — click Allow)

STEP 3 — Create the database
    npx wrangler d1 create forum-db
  The output shows a line like:  database_id = "xxxxxxxx-xxxx-...."
  COPY that id, open wrangler.toml in this folder, and paste it over
  PASTE_YOUR_DATABASE_ID_HERE. Save the file.

STEP 4 — Fill the database with tables + starter content
    npx wrangler d1 execute forum-db --remote --file=schema.sql

STEP 5 — Build the site
    npm run build

STEP 6 — Deploy
    npx wrangler pages deploy dist --project-name nyc-sidewalk-forum
  First time it asks to create the project — say yes (production branch: main).
  It prints your live URL: https://nyc-sidewalk-forum.pages.dev
  The D1 binding is picked up automatically from wrangler.toml.

THAT'S IT. Open the URL — the forum is live with the seeded NYC threads.
Create an account, post, like, chat: everything is shared between all visitors.

=====================================================================
UPDATING THE SITE LATER
=====================================================================
  Make changes -> npm run build -> npx wrangler pages deploy dist --project-name nyc-sidewalk-forum

=====================================================================
CUSTOM DOMAIN
=====================================================================
  Dashboard -> Workers & Pages -> nyc-sidewalk-forum -> Custom domains -> Add.
  If the domain's DNS is already on Cloudflare it activates instantly.

=====================================================================
VIEWING YOUR LEADS
=====================================================================
Option A (no setup): every lead is stored in D1. See them with:
    npx wrangler d1 execute forum-db --remote --command "SELECT * FROM leads ORDER BY created DESC"

Option B (in browser): set a secret first —
    Dashboard -> your Pages project -> Settings -> Environment variables
    -> add ADMIN_KEY = some-long-secret -> redeploy
  Then open:  https://YOUR-SITE.pages.dev/api/leads?key=some-long-secret

Option C (email alerts, free): create a free account at resend.com,
  get an API key, then in the same Environment variables screen add:
    RESEND_API_KEY = re_xxxxxxxx
    LEAD_EMAIL    = you@yourdomain.com
  Redeploy. Every lead now also emails you instantly.

=====================================================================
NOTES
=====================================================================
- Seed members (Marisol, Tony, Eden team, etc.) cannot be logged into; they
  exist so the forum never looks empty. Eden team auto-replies to private
  messages with a canned greeting.
- Free tier limits are generous: 100,000 API requests/day, 5 GB database.
- Photos are compressed in the browser and stored in D1. If the forum grows
  big, the next upgrade is moving images to Cloudflare R2 (also has a free tier).
- To moderate/delete content, use D1 from the dashboard (Workers & Pages -> D1
  -> forum-db -> Console) and run SQL like: DELETE FROM threads WHERE id='...';
