// NYC Sidewalk Forum API — Cloudflare Pages Functions + D1
// All routes live under /api/* and share the D1 binding named DB.

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const err = (message, status = 400) => json({ error: message }, status);

const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

/* ---------- password hashing (PBKDF2-SHA256) ---------- */
const toHex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");

async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const salt = Uint8Array.from(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256);
  return toHex(bits);
}

const newSalt = () => toHex(crypto.getRandomValues(new Uint8Array(16)));

/* ---------- session ---------- */
async function getUser(db, request) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  const row = await db.prepare(
    "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?"
  ).bind(token).first();
  return row || null;
}

const publicUser = (u) => ({
  id: u.id, username: u.username, displayName: u.display_name, borough: u.borough,
  bio: u.bio || "", avatarColor: u.avatar_color, joined: u.joined, seed: !!u.seed,
});

const AVATAR_COLORS = ["#0B5D6A", "#8A5A2B", "#5B3D8A", "#2E7D52", "#A4452F", "#1F5F8B", "#7A6210"];
const MAX_IMG = 400000; // ~400KB per base64 image keeps rows well under D1 limits

const cleanMedia = (m, max) => {
  if (!Array.isArray(m)) return [];
  return m.slice(0, max).filter(s => typeof s === "string" && s.startsWith("data:image/") && s.length <= MAX_IMG);
};

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;
  if (!db) return err("D1 binding 'DB' is missing. Add it in wrangler.toml or project settings.", 500);
  const route = (params.path || []).join("/");
  const method = request.method;

  try {
    /* ================= STATE ================= */
    if (route === "state" && method === "GET") {
      const me = await getUser(db, request);
      const [usersQ, threadsQ, repliesQ, likesQ] = await db.batch([
        db.prepare("SELECT * FROM users"),
        db.prepare("SELECT * FROM threads"),
        db.prepare("SELECT * FROM replies"),
        db.prepare("SELECT * FROM likes"),
      ]);
      const likesByTarget = {};
      for (const l of likesQ.results) (likesByTarget[l.target_id] ||= []).push(l.user_id);
      const repliesByThread = {};
      for (const r of repliesQ.results) {
        (repliesByThread[r.thread_id] ||= []).push({
          id: r.id, authorId: r.author_id, body: r.body, createdAt: r.created,
          likes: likesByTarget[r.id] || [], media: JSON.parse(r.media || "[]"),
        });
      }
      const threads = threadsQ.results.map(t => ({
        id: t.id, categoryId: t.category_id, title: t.title, body: t.body,
        authorId: t.author_id, createdAt: t.created, views: t.views, pinned: !!t.pinned,
        likes: likesByTarget[t.id] || [], media: JSON.parse(t.media || "[]"),
        replies: (repliesByThread[t.id] || []).sort((a, b) => a.createdAt - b.createdAt),
      }));
      let conversations = [];
      if (me) {
        const msgs = await db.prepare(
          "SELECT * FROM messages WHERE from_id = ?1 OR to_id = ?1 ORDER BY created ASC"
        ).bind(me.id).all();
        const byKey = {};
        for (const m of msgs.results) {
          const key = [m.from_id, m.to_id].sort().join("|");
          (byKey[key] ||= { key, between: key.split("|"), items: [] }).items.push({
            id: m.id, from: m.from_id, text: m.text || undefined, img: m.img || undefined, at: m.created,
          });
        }
        conversations = Object.values(byKey);
      }
      return json({
        users: usersQ.results.map(publicUser),
        threads, conversations,
        me: me ? publicUser(me) : null,
      });
    }

    /* ================= AUTH ================= */
    if (route === "signup" && method === "POST") {
      const b = await request.json();
      const username = String(b.username || "").trim().toLowerCase();
      const password = String(b.password || "");
      if (username.length < 3) return err("Username needs at least 3 characters.");
      if (!/^[a-z0-9_]+$/.test(username)) return err("Username can only contain letters, numbers and underscores.");
      if (password.length < 6) return err("Password needs at least 6 characters.");
      const exists = await db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
      if (exists) return err("That username is taken.");
      const salt = newSalt();
      const hash = await hashPassword(password, salt);
      const user = {
        id: uid(), username,
        display_name: String(b.displayName || username).trim().slice(0, 40) || username,
        borough: String(b.borough || "Brooklyn").slice(0, 20),
        avatar_color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        joined: Date.now(),
      };
      await db.prepare(
        "INSERT INTO users (id, username, display_name, borough, avatar_color, pass_hash, salt, joined) VALUES (?,?,?,?,?,?,?,?)"
      ).bind(user.id, user.username, user.display_name, user.borough, user.avatar_color, hash, salt, user.joined).run();
      const token = crypto.randomUUID() + crypto.randomUUID();
      await db.prepare("INSERT INTO sessions (token, user_id, created) VALUES (?,?,?)").bind(token, user.id, Date.now()).run();
      return json({ token, user: publicUser({ ...user, bio: "", seed: 0 }) });
    }

    if (route === "login" && method === "POST") {
      const b = await request.json();
      const username = String(b.username || "").trim().toLowerCase();
      const u = await db.prepare("SELECT * FROM users WHERE username = ?").bind(username).first();
      if (!u || !u.pass_hash) return err("Wrong username or password.", 401);
      const hash = await hashPassword(String(b.password || ""), u.salt);
      if (hash !== u.pass_hash) return err("Wrong username or password.", 401);
      const token = crypto.randomUUID() + crypto.randomUUID();
      await db.prepare("INSERT INTO sessions (token, user_id, created) VALUES (?,?,?)").bind(token, u.id, Date.now()).run();
      return json({ token, user: publicUser(u) });
    }

    if (route === "logout" && method === "POST") {
      const auth = request.headers.get("Authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
      if (token) await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
      return json({ ok: true });
    }

    /* ================= CONTENT (auth required) ================= */
    const me = await getUser(db, request);
    const needAuth = () => err("Please log in.", 401);

    if (route === "thread" && method === "POST") {
      if (!me) return needAuth();
      const b = await request.json();
      const title = String(b.title || "").trim().slice(0, 140);
      const body = String(b.body || "").trim().slice(0, 8000);
      if (!title || !body) return err("Title and details are required.");
      const id = uid();
      await db.prepare(
        "INSERT INTO threads (id, category_id, title, body, author_id, created, views, media) VALUES (?,?,?,?,?,?,1,?)"
      ).bind(id, String(b.categoryId || "general"), title, body, me.id, Date.now(), JSON.stringify(cleanMedia(b.media, 4))).run();
      return json({ id });
    }

    if (route === "reply" && method === "POST") {
      if (!me) return needAuth();
      const b = await request.json();
      const body = String(b.body || "").trim().slice(0, 8000);
      const media = cleanMedia(b.media, 3);
      if (!body && media.length === 0) return err("Reply is empty.");
      const t = await db.prepare("SELECT id FROM threads WHERE id = ?").bind(b.threadId).first();
      if (!t) return err("Thread not found.", 404);
      await db.prepare(
        "INSERT INTO replies (id, thread_id, author_id, body, created, media) VALUES (?,?,?,?,?,?)"
      ).bind(uid(), t.id, me.id, body, Date.now(), JSON.stringify(media)).run();
      return json({ ok: true });
    }

    if (route === "like" && method === "POST") {
      if (!me) return needAuth();
      const b = await request.json();
      const target = String(b.targetId || "");
      if (!target) return err("Missing target.");
      const existing = await db.prepare("SELECT 1 AS x FROM likes WHERE user_id = ? AND target_id = ?").bind(me.id, target).first();
      if (existing) await db.prepare("DELETE FROM likes WHERE user_id = ? AND target_id = ?").bind(me.id, target).run();
      else await db.prepare("INSERT INTO likes (user_id, target_id) VALUES (?,?)").bind(me.id, target).run();
      return json({ liked: !existing });
    }

    if (route === "view" && method === "POST") {
      const b = await request.json();
      await db.prepare("UPDATE threads SET views = views + 1 WHERE id = ?").bind(String(b.threadId || "")).run();
      return json({ ok: true });
    }

    if (route === "profile" && method === "POST") {
      if (!me) return needAuth();
      const b = await request.json();
      await db.prepare("UPDATE users SET bio = ? WHERE id = ?").bind(String(b.bio || "").slice(0, 500), me.id).run();
      return json({ ok: true });
    }

    if (route === "message" && method === "POST") {
      if (!me) return needAuth();
      const b = await request.json();
      const to = await db.prepare("SELECT * FROM users WHERE id = ?").bind(String(b.toUserId || "")).first();
      if (!to) return err("Member not found.", 404);
      const text = b.text ? String(b.text).trim().slice(0, 2000) : null;
      const img = (typeof b.img === "string" && b.img.startsWith("data:image/") && b.img.length <= MAX_IMG) ? b.img : null;
      if (!text && !img) return err("Message is empty.");
      await db.prepare("INSERT INTO messages (id, from_id, to_id, text, img, created) VALUES (?,?,?,?,?,?)")
        .bind(uid(), me.id, to.id, text, img, Date.now()).run();
      if (to.seed) {
        const canned = img
          ? "Got the photo, thanks — that helps a lot. What borough is this in?"
          : to.id === "seed-eden_team"
            ? "Thanks for reaching out! Share your borough and a quick description (or violation number) and we'll get you a free estimate within one business day."
            : "Hey! Saw your message — happy to help. What borough are you in and what's the sidewalk looking like?";
        await db.prepare("INSERT INTO messages (id, from_id, to_id, text, created) VALUES (?,?,?,?,?)")
          .bind(uid(), to.id, me.id, canned, Date.now() + 1).run();
      }
      return json({ ok: true });
    }

    /* ================= LEADS ================= */
    if (route === "lead" && method === "POST") {
      const b = await request.json();
      const name = String(b.name || "").trim().slice(0, 80);
      const contact = String(b.contact || "").trim().slice(0, 120);
      if (!name || !contact) return err("Name and contact are required.");
      const lead = {
        id: uid(), name, contact,
        borough: String(b.borough || "").slice(0, 20),
        detail: String(b.detail || "").slice(0, 2000),
        created: Date.now(),
      };
      await db.prepare("INSERT INTO leads (id, name, contact, borough, detail, created) VALUES (?,?,?,?,?,?)")
        .bind(lead.id, lead.name, lead.contact, lead.borough, lead.detail, lead.created).run();
      // Optional email alert via Resend (free tier). Set RESEND_API_KEY and LEAD_EMAIL env vars.
      if (env.RESEND_API_KEY && env.LEAD_EMAIL) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.RESEND_API_KEY },
            body: JSON.stringify({
              from: "Forum Leads <onboarding@resend.dev>",
              to: [env.LEAD_EMAIL],
              subject: "New sidewalk lead: " + lead.name + " (" + lead.borough + ")",
              text: "Name: " + lead.name + "\nContact: " + lead.contact + "\nBorough: " + lead.borough + "\n\n" + lead.detail,
            }),
          });
        } catch (e) { /* lead is already saved in D1; email is best-effort */ }
      }
      return json({ ok: true });
    }

    /* ===== view stored leads (protect with a secret) =====
       GET /api/leads?key=YOUR_ADMIN_KEY  (set ADMIN_KEY env var) */
    if (route === "leads" && method === "GET") {
      const url = new URL(request.url);
      if (!env.ADMIN_KEY || url.searchParams.get("key") !== env.ADMIN_KEY) return err("Not allowed.", 403);
      const rows = await db.prepare("SELECT * FROM leads ORDER BY created DESC").all();
      return json(rows.results);
    }

    return err("Not found: " + route, 404);
  } catch (e) {
    return err("Server error: " + (e.message || e), 500);
  }
}
