import React, { useState, useEffect, useRef, useMemo } from "react";

/* ============================================================
   NYC SIDEWALK FORUM — community platform for sidewalk repair
   Brand: teal #0B5D6A, gold #F4BD14
   Type: Space Grotesk (display) + DM Sans (body)
   Backend: Cloudflare Pages Functions + D1 (/api/*)
   ============================================================ */

const C = {
  teal: "#0B5D6A",
  tealDark: "#073C45",
  tealDeep: "#052A31",
  gold: "#F4BD14",
  goldSoft: "#FDF3CF",
  paper: "#F6F7F6",
  card: "#FFFFFF",
  ink: "#14272B",
  inkSoft: "#4A6066",
  line: "#E2E8E7",
  tealTint: "#EAF2F3",
  red: "#C24A3A",
  green: "#2E7D52",
};

const FONT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
.sg { font-family: 'Space Grotesk', sans-serif; }
.dm { font-family: 'DM Sans', sans-serif; }
.flagline { background-image: repeating-linear-gradient(90deg, rgba(255,255,255,0.14) 0 1px, transparent 1px 72px); }
.thread-row:hover { background: #F0F5F5; }
.fadein { animation: fadein .25s ease; }
@keyframes fadein { from { opacity: 0; transform: translateY(4px);} to { opacity:1; transform:none; } }
@media (prefers-reduced-motion: reduce) { .fadein { animation: none; } }
input:focus, textarea:focus, select:focus, button:focus-visible { outline: 2px solid #F4BD14; outline-offset: 1px; }
::placeholder { color: #8FA3A7; }
`;

const BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];

const CATEGORIES = [
  { id: "violations", name: "DOT Violations & Notices", tag: "VIOLATIONS", desc: "Got a sidewalk violation from NYC DOT? Decode it, dispute it, or fix it.", icon: "⚠" },
  { id: "costs", name: "Repair Costs & Quotes", tag: "COSTS", desc: "Compare quotes, price-per-flag questions, and what's fair in your borough.", icon: "$" },
  { id: "permits", name: "Permits & Inspections", tag: "PERMITS", desc: "DOT permits, dismissal inspections, and paperwork questions.", icon: "✓" },
  { id: "trees", name: "Tree Roots & Heaving", tag: "TREES", desc: "City trees lifting your sidewalk? Parks Dept programs and root solutions.", icon: "⌖" },
  { id: "curbs", name: "Curbs, Driveways & Concrete", tag: "CONCRETE", desc: "Curb cuts, driveway aprons, concrete mixes, curing and finishing.", icon: "▦" },
  { id: "contractors", name: "Hiring a Contractor", tag: "HIRING", desc: "Licenses, insurance, red flags, and how to vet a sidewalk contractor.", icon: "◉" },
  { id: "general", name: "General NYC Property Talk", tag: "GENERAL", desc: "Everything else for NYC homeowners and property managers.", icon: "✦" },
];

const AVATAR_COLORS = ["#0B5D6A", "#8A5A2B", "#5B3D8A", "#2E7D52", "#A4452F", "#1F5F8B", "#7A6210"];

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const now = () => Date.now();

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60); if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24); if (d < 30) return d + "d ago";
  const mo = Math.floor(d / 30); if (mo < 12) return mo + "mo ago";
  return Math.floor(mo / 12) + "y ago";
}


/* ---------------- API client ---------------- */
let TOKEN = null;
try { TOKEN = localStorage.getItem("forum-token"); } catch (e) {}

async function api(path, body) {
  const res = await fetch("/api/" + path, {
    method: body !== undefined ? "POST" : "GET",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(TOKEN ? { Authorization: "Bearer " + TOKEN } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed (" + res.status + ")");
  return data;
}

function setToken(t) {
  TOKEN = t;
  try { t ? localStorage.setItem("forum-token", t) : localStorage.removeItem("forum-token"); } catch (e) {}
}

/* ---------------- Small shared UI ---------------- */
function Avatar({ user, size = 36 }) {
  const initials = (user?.displayName || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="sg flex items-center justify-center rounded-full shrink-0 font-semibold text-white"
      style={{ width: size, height: size, background: user?.avatarColor || C.teal, fontSize: size * 0.38 }}>
      {initials}
    </div>
  );
}

function Btn({ children, kind = "primary", onClick, type = "button", small, disabled, style }) {
  const base = {
    primary: { background: C.teal, color: "#fff", border: "1px solid " + C.teal },
    gold: { background: C.gold, color: C.tealDeep, border: "1px solid " + C.gold },
    ghost: { background: "transparent", color: C.teal, border: "1px solid " + C.line },
    danger: { background: "transparent", color: C.red, border: "1px solid " + C.line },
  }[kind];
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={"sg rounded-lg font-semibold transition-opacity " + (small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm")}
      style={{ ...base, opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer", ...style }}>
      {children}
    </button>
  );
}

function Tag({ children, gold }) {
  return (
    <span className="sg text-[10px] font-bold tracking-widest px-2 py-0.5 rounded"
      style={{ background: gold ? C.goldSoft : C.tealTint, color: gold ? "#7A6210" : C.teal, letterSpacing: "0.12em" }}>
      {children}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="sg block text-xs font-semibold mb-1 tracking-wide" style={{ color: C.inkSoft }}>{label}</span>
      {children}
    </label>
  );
}

const inputCls = "dm w-full rounded-lg px-3 py-2 text-sm bg-white";
const inputStyle = { border: "1px solid " + C.line, color: C.ink };

/* ---------------- Media: compress, pick, display ---------------- */
function compressImage(file, maxDim = 800, quality = 0.65) {
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith("image/")) return reject(new Error("Only image files are supported."));
    if (file.size > 12 * 1024 * 1024) return reject(new Error("Image is too large (max 12 MB)."));
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Could not read that image."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

function MediaPicker({ media, setMedia, max = 4, label = "Add photos" }) {
  const inputRef = useRef(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const onFiles = async (e) => {
    setErr("");
    const files = Array.from(e.target.files || []).slice(0, Math.max(0, max - media.length));
    if (!files.length) return;
    setBusy(true);
    const out = [];
    for (const f of files) {
      try { out.push(await compressImage(f)); } catch (ex) { setErr(ex.message); }
    }
    setBusy(false);
    if (out.length) setMedia([...media, ...out]);
    if (inputRef.current) inputRef.current.value = "";
  };
  return (
    <div className="mt-2">
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
      {media.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-2">
          {media.map((src, i) => (
            <div key={i} className="relative">
              <img src={src} alt={"attachment " + (i + 1)} className="rounded-lg object-cover" style={{ width: 72, height: 72, border: "1px solid " + C.line }} />
              <button onClick={() => setMedia(media.filter((_, j) => j !== i))} aria-label="Remove photo"
                className="sg absolute -top-1.5 -right-1.5 rounded-full text-[11px] font-bold flex items-center justify-center"
                style={{ width: 18, height: 18, background: C.ink, color: "#fff" }}>×</button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button onClick={() => inputRef.current?.click()} disabled={busy || media.length >= max}
          className="dm text-xs font-semibold rounded-md px-2.5 py-1.5"
          style={{ color: media.length >= max ? C.inkSoft : C.teal, background: C.tealTint, border: "1px solid " + C.line, opacity: busy ? 0.6 : 1 }}>
          {busy ? "Processing…" : "📷 " + label + (max > 1 ? ` (${media.length}/${max})` : "")}
        </button>
        {err && <span className="dm text-xs font-medium" style={{ color: C.red }}>{err}</span>}
      </div>
    </div>
  );
}

function MediaGrid({ media, small }) {
  const [open, setOpen] = useState(null);
  if (!media || media.length === 0) return null;
  const size = small ? 110 : 150;
  return (
    <>
      <div className="flex gap-2 flex-wrap mt-3">
        {media.map((src, i) => (
          <button key={i} onClick={() => setOpen(src)} aria-label={"View photo " + (i + 1)}>
            <img src={src} alt={"photo " + (i + 1)} className="rounded-lg object-cover transition-opacity hover:opacity-90"
              style={{ width: size, height: size, border: "1px solid " + C.line }} />
          </button>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 cursor-zoom-out" style={{ background: "rgba(5,42,49,0.85)" }} onClick={() => setOpen(null)}>
          <img src={open} alt="full size photo" className="fadein rounded-xl max-w-full max-h-full object-contain" style={{ maxHeight: "90vh" }} />
          <button onClick={() => setOpen(null)} aria-label="Close photo"
            className="sg absolute top-4 right-4 rounded-full font-bold flex items-center justify-center"
            style={{ width: 34, height: 34, background: C.gold, color: C.tealDeep }}>×</button>
        </div>
      )}
    </>
  );
}

/* ---------------- Lead-gen CTA (the sponsor block) ---------------- */
function EstimateCTA({ compact, onLead }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: C.tealDeep, border: "1px solid " + C.tealDark }}>
      <div className="flagline px-4 pt-4 pb-3">
        <div className="sg text-[10px] font-bold tracking-widest mb-2" style={{ color: C.gold, letterSpacing: "0.16em" }}>SPONSOR · EDEN CONTRACTORS NY</div>
        <div className="sg text-white font-bold leading-snug" style={{ fontSize: compact ? 15 : 17 }}>
          Sidewalk violation? Get a free estimate within 24 hours.
        </div>
        <div className="dm text-xs mt-1.5 leading-relaxed" style={{ color: "#9FC2C9" }}>
          Licensed & insured · DOT permits handled · All 5 boroughs
        </div>
      </div>
      <div className="px-4 pb-4">
        <Btn kind="gold" onClick={onLead} style={{ width: "100%" }}>Request free estimate</Btn>
      </div>
    </div>
  );
}

function LeadModal({ onClose, currentUser }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ name: currentUser?.displayName || "", phone: "", borough: currentUser?.borough || "Brooklyn", detail: "" });
  const submitLead = async () => {
    setBusy(true); setErr("");
    try {
      await api("lead", { name: form.name, contact: form.phone, borough: form.borough, detail: form.detail });
      setSent(true);
    } catch (ex) { setErr(ex.message); }
    setBusy(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(5,42,49,0.55)" }} onClick={onClose}>
      <div className="fadein w-full max-w-md rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()} style={{ border: "1px solid " + C.line }}>
        {sent ? (
          <div className="text-center py-6">
            <div className="sg text-4xl mb-3" style={{ color: C.green }}>✓</div>
            <div className="sg font-bold text-lg" style={{ color: C.ink }}>Request received</div>
            <p className="dm text-sm mt-2" style={{ color: C.inkSoft }}>The Eden Contractors team will reach out within one business day with your free estimate.</p>
            <div className="mt-5"><Btn onClick={onClose}>Back to forum</Btn></div>
          </div>
        ) : (
          <>
            <div className="sg text-[10px] font-bold tracking-widest mb-1" style={{ color: C.teal, letterSpacing: "0.14em" }}>FREE ESTIMATE</div>
            <h3 className="sg font-bold text-xl mb-4" style={{ color: C.ink }}>Tell us about your sidewalk</h3>
            <Field label="YOUR NAME"><input className={inputCls} style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="PHONE OR EMAIL"><input className={inputCls} style={inputStyle} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(718) 000-0000" /></Field>
            <Field label="BOROUGH">
              <select className={inputCls} style={inputStyle} value={form.borough} onChange={e => setForm({ ...form, borough: e.target.value })}>
                {BOROUGHS.map(b => <option key={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="WHAT'S GOING ON? (VIOLATION, CRACKED FLAGS, TREE ROOTS...)">
              <textarea className={inputCls} style={{ ...inputStyle, minHeight: 80 }} value={form.detail} onChange={e => setForm({ ...form, detail: e.target.value })} />
            </Field>
            <div className="flex gap-2 mt-2">
              <Btn kind="gold" onClick={submitLead} disabled={busy || !form.name || !form.phone} style={{ flex: 1 }}>{busy ? "Sending…" : "Send request"}</Btn>
              <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
            </div>
            {err && <div className="dm text-xs mt-2 font-medium" style={{ color: C.red }}>{err}</div>}
            <p className="dm text-[11px] mt-3" style={{ color: C.inkSoft }}>No spam. Your details go only to the Eden Contractors estimate team.</p>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Auth ---------------- */
function AuthModal({ onClose, onAuth, data }) {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ username: "", password: "", displayName: "", borough: "Brooklyn" });
  const [err, setErr] = useState("");

  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr("");
    const uname = f.username.trim().toLowerCase();
    if (!uname || !f.password) return setErr("Username and password are required.");
    setBusy(true);
    try {
      const r = mode === "signup"
        ? await api("signup", { username: uname, password: f.password, displayName: f.displayName, borough: f.borough })
        : await api("login", { username: uname, password: f.password });
      setToken(r.token);
      onAuth(r.user);
    } catch (ex) { setErr(ex.message); }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(5,42,49,0.55)" }} onClick={onClose}>
      <div className="fadein w-full max-w-sm rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()} style={{ border: "1px solid " + C.line }}>
        <div className="flex gap-1 mb-5 rounded-lg p-1" style={{ background: C.paper }}>
          {["login", "signup"].map(m => (
            <button key={m} onClick={() => { setMode(m); setErr(""); }}
              className="sg flex-1 py-1.5 rounded-md text-sm font-semibold"
              style={mode === m ? { background: C.teal, color: "#fff" } : { color: C.inkSoft }}>
              {m === "login" ? "Log in" : "Create account"}
            </button>
          ))}
        </div>
        <Field label="USERNAME"><input className={inputCls} style={inputStyle} value={f.username} onChange={e => setF({ ...f, username: e.target.value })} placeholder="e.g. mike_bklyn" /></Field>
        {mode === "signup" && (
          <>
            <Field label="DISPLAY NAME"><input className={inputCls} style={inputStyle} value={f.displayName} onChange={e => setF({ ...f, displayName: e.target.value })} placeholder="How others see you" /></Field>
            <Field label="BOROUGH">
              <select className={inputCls} style={inputStyle} value={f.borough} onChange={e => setF({ ...f, borough: e.target.value })}>
                {BOROUGHS.map(b => <option key={b}>{b}</option>)}
              </select>
            </Field>
          </>
        )}
        <Field label="PASSWORD"><input type="password" className={inputCls} style={inputStyle} value={f.password} onChange={e => setF({ ...f, password: e.target.value })} onKeyDown={e => e.key === "Enter" && submit()} /></Field>
        {err && <div className="dm text-xs mb-2 font-medium" style={{ color: C.red }}>{err}</div>}
        <Btn onClick={submit} disabled={busy} style={{ width: "100%", marginTop: 4 }}>{busy ? "One sec…" : mode === "login" ? "Log in" : "Join the forum"}</Btn>
        <p className="dm text-[11px] mt-3 text-center" style={{ color: C.inkSoft }}>Free to join · Ask questions · Chat privately with members</p>
      </div>
    </div>
  );
}

/* ---------------- Thread list row ---------------- */
function ThreadRow({ thread, data, onOpen, onOpenProfile, onOpenCategory }) {
  const author = data.users.find(u => u.id === thread.authorId);
  const cat = CATEGORIES.find(c => c.id === thread.categoryId);
  const last = thread.replies[thread.replies.length - 1];
  return (
    <div onClick={onOpen} role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" && e.target === e.currentTarget) onOpen(); }}
      className="thread-row w-full text-left px-4 py-3.5 flex gap-3 items-start transition-colors cursor-pointer"
      style={{ borderBottom: "1px solid " + C.line }}>
      <button onClick={e => { e.stopPropagation(); onOpenProfile(author); }} aria-label={"View profile of " + (author?.displayName || "member")}>
        <Avatar user={author} size={38} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {thread.pinned && <Tag gold>PINNED</Tag>}
          <button onClick={e => { e.stopPropagation(); onOpenCategory(thread.categoryId); }} title={cat?.name}>
            <Tag>{cat?.tag}</Tag>
          </button>
        </div>
        <div className="sg font-semibold mt-1 leading-snug" style={{ color: C.ink, fontSize: 15 }}>{thread.title}</div>
        <div className="dm text-xs mt-1 flex items-center gap-2 flex-wrap" style={{ color: C.inkSoft }}>
          <button className="font-medium hover:underline" style={{ color: C.teal }}
            onClick={e => { e.stopPropagation(); onOpenProfile(author); }}>{author?.displayName}</button>
          <span>· {author?.borough}</span>
          <span>· {timeAgo(thread.createdAt)}</span>
          {(thread.media?.length > 0 || thread.replies.some(r => r.media?.length)) && <span style={{ color: C.teal }}>· 📷</span>}
          {last && <span>· last reply {timeAgo(last.createdAt)}</span>}
        </div>
      </div>
      <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 pt-0.5">
        <div className="sg text-sm font-bold" style={{ color: C.teal }}>{thread.replies.length}<span className="dm font-normal text-[11px]" style={{ color: C.inkSoft }}> replies</span></div>
        <div className="dm text-[11px]" style={{ color: C.inkSoft }}>{thread.views} views · {thread.likes.length} ♥</div>
      </div>
    </div>
  );
}

/* ---------------- Composer (new thread) ---------------- */
function NewThread({ data, currentUser, defaultCat, onCancel, onCreate }) {
  const [f, setF] = useState({ title: "", body: "", categoryId: defaultCat || "violations" });
  const [media, setMedia] = useState([]);
  return (
    <div className="fadein rounded-xl bg-white p-5" style={{ border: "1px solid " + C.line }}>
      <h2 className="sg font-bold text-xl mb-4" style={{ color: C.ink }}>Start a discussion</h2>
      <Field label="CATEGORY">
        <select className={inputCls} style={inputStyle} value={f.categoryId} onChange={e => setF({ ...f, categoryId: e.target.value })}>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="TITLE">
        <input className={inputCls} style={inputStyle} value={f.title} maxLength={140}
          onChange={e => setF({ ...f, title: e.target.value })}
          placeholder="Be specific — e.g. 'Violation for 2 flags in Flatbush, is $900 fair?'" />
      </Field>
      <Field label="DETAILS">
        <textarea className={inputCls} style={{ ...inputStyle, minHeight: 140 }} value={f.body}
          onChange={e => setF({ ...f, body: e.target.value })}
          placeholder="Add your borough, flag count, what the notice says, photos descriptions... The more detail, the better the answers." />
      </Field>
      <Field label="PHOTOS — VIOLATION NOTICES, CRACKED FLAGS, TREE ROOTS (OPTIONAL)">
        <MediaPicker media={media} setMedia={setMedia} max={4} />
      </Field>
      <div className="flex gap-2">
        <Btn onClick={() => onCreate({ ...f, media })} disabled={!f.title.trim() || !f.body.trim()}>Post discussion</Btn>
        <Btn kind="ghost" onClick={onCancel}>Cancel</Btn>
      </div>
    </div>
  );
}

/* ---------------- Thread view ---------------- */
function ThreadView({ thread, data, currentUser, onBack, requireAuth, actions, onOpenProfile, onMessage, onOpenCategory }) {
  const [reply, setReply] = useState("");
  const [replyMedia, setReplyMedia] = useState([]);
  const [posting, setPosting] = useState(false);
  const author = data.users.find(u => u.id === thread.authorId);
  const cat = CATEGORIES.find(c => c.id === thread.categoryId);
  const liked = currentUser && thread.likes.includes(currentUser.id);

  const toggleLike = (target) => {
    if (!currentUser) return requireAuth();
    actions.toggleLike(target === "thread" ? thread.id : target);
  };

  const postReply = async () => {
    if (!currentUser) return requireAuth();
    if (!reply.trim() && replyMedia.length === 0) return;
    setPosting(true);
    await actions.postReply(thread.id, reply.trim(), replyMedia);
    setPosting(false);
    setReply("");
    setReplyMedia([]);
  };

  const Post = ({ p, isOP }) => {
    const u = data.users.find(x => x.id === p.authorId);
    const pliked = currentUser && p.likes.includes(currentUser.id);
    return (
      <div className="px-4 sm:px-5 py-4 flex gap-3" style={{ borderBottom: "1px solid " + C.line }}>
        <div className="flex flex-col items-center gap-1">
          <Avatar user={u} size={40} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button className="sg font-semibold text-sm hover:underline" style={{ color: C.ink }} onClick={() => onOpenProfile(u)}>{u?.displayName}</button>
            {u?.id === "seed-eden_team" && <Tag gold>SPONSOR</Tag>}
            {isOP && <Tag>ORIGINAL POSTER</Tag>}
            <span className="dm text-xs" style={{ color: C.inkSoft }}>{u?.borough} · {timeAgo(p.createdAt)}</span>
          </div>
          <p className="dm text-sm mt-2 leading-relaxed whitespace-pre-wrap" style={{ color: C.ink }}>{p.body}</p>
          <MediaGrid media={p.media} small={!isOP} />
          <div className="flex items-center gap-3 mt-3">
            <button onClick={() => toggleLike(isOP ? "thread" : p.id)} className="dm text-xs font-semibold rounded-md px-2 py-1"
              style={{ color: (isOP ? liked : pliked) ? C.red : C.inkSoft, background: C.paper, border: "1px solid " + C.line }}>
              ♥ {p.likes.length} {(isOP ? liked : pliked) ? "Liked" : "Like"}
            </button>
            {currentUser && u && u.id !== currentUser.id && (
              <button onClick={() => onMessage(u)} className="dm text-xs font-semibold rounded-md px-2 py-1"
                style={{ color: C.teal, background: C.tealTint, border: "1px solid " + C.line }}>
                Message privately
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fadein rounded-xl bg-white overflow-hidden" style={{ border: "1px solid " + C.line }}>
      <div className="px-4 sm:px-5 pt-4 pb-3" style={{ borderBottom: "1px solid " + C.line, background: C.paper }}>
        <button onClick={onBack} className="dm text-xs font-semibold mb-2" style={{ color: C.teal }}>← Back to discussions</button>
        <div className="flex items-center gap-2 flex-wrap mb-1">
          {thread.pinned && <Tag gold>PINNED</Tag>}
          <button onClick={() => onOpenCategory(thread.categoryId)} title={"Go to " + (cat?.name || "category")}><Tag>{cat?.tag}</Tag></button>
        </div>
        <h1 className="sg font-bold leading-snug" style={{ color: C.ink, fontSize: 21 }}>{thread.title}</h1>
        <div className="dm text-xs mt-1" style={{ color: C.inkSoft }}>{thread.views} views · {thread.replies.length} replies</div>
      </div>
      <Post p={thread} isOP />
      {thread.replies.map(r => <Post key={r.id} p={r} />)}
      <div className="px-4 sm:px-5 py-4" style={{ background: C.paper }}>
        {currentUser ? (
          <div className="flex gap-3 items-start">
            <Avatar user={currentUser} size={36} />
            <div className="flex-1">
              <textarea className={inputCls} style={{ ...inputStyle, minHeight: 80 }} value={reply}
                onChange={e => setReply(e.target.value)} placeholder="Write a helpful reply..." />
              <MediaPicker media={replyMedia} setMedia={setReplyMedia} max={3} />
              <div className="mt-2"><Btn small onClick={postReply} disabled={posting || (!reply.trim() && replyMedia.length === 0)}>{posting ? "Posting…" : "Post reply"}</Btn></div>
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <span className="dm text-sm mr-3" style={{ color: C.inkSoft }}>Join the conversation —</span>
            <Btn small onClick={requireAuth}>Log in or create an account</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Profile ---------------- */
function ProfileView({ user, data, currentUser, onBack, onOpenThread, onMessage, onSaveBio }) {
  const [bio, setBio] = useState(user.bio || "");
  const [editing, setEditing] = useState(false);
  const theirThreads = data.threads.filter(t => t.authorId === user.id);
  const replyCount = data.threads.reduce((n, t) => n + t.replies.filter(r => r.authorId === user.id).length, 0);
  const mine = currentUser?.id === user.id;
  return (
    <div className="fadein rounded-xl bg-white overflow-hidden" style={{ border: "1px solid " + C.line }}>
      <div className="flagline px-5 py-6" style={{ background: C.tealDeep }}>
        <button onClick={onBack} className="dm text-xs font-semibold mb-3 block" style={{ color: C.gold }}>← Back</button>
        <div className="flex items-center gap-4">
          <Avatar user={user} size={64} />
          <div>
            <div className="sg font-bold text-xl text-white">{user.displayName}</div>
            <div className="dm text-xs" style={{ color: "#9FC2C9" }}>@{user.username} · {user.borough} · joined {timeAgo(user.joined)}</div>
          </div>
        </div>
      </div>
      <div className="px-5 py-4" style={{ borderBottom: "1px solid " + C.line }}>
        {editing ? (
          <div>
            <textarea className={inputCls} style={{ ...inputStyle, minHeight: 70 }} value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell the community about yourself..." />
            <div className="flex gap-2 mt-2">
              <Btn small onClick={() => { onSaveBio(bio); setEditing(false); }}>Save bio</Btn>
              <Btn small kind="ghost" onClick={() => setEditing(false)}>Cancel</Btn>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <p className="dm text-sm leading-relaxed" style={{ color: user.bio ? C.ink : C.inkSoft }}>{user.bio || "No bio yet."}</p>
            {mine ? <Btn small kind="ghost" onClick={() => setEditing(true)}>Edit bio</Btn>
              : currentUser && <Btn small onClick={() => onMessage(user)}>Message</Btn>}
          </div>
        )}
        <div className="dm text-xs mt-3 flex gap-4" style={{ color: C.inkSoft }}>
          <span><b className="sg" style={{ color: C.teal }}>{theirThreads.length}</b> discussions</span>
          <span><b className="sg" style={{ color: C.teal }}>{replyCount}</b> replies</span>
        </div>
      </div>
      <div className="px-5 py-3 sg text-xs font-bold tracking-widest" style={{ color: C.inkSoft, letterSpacing: "0.12em" }}>DISCUSSIONS STARTED</div>
      {theirThreads.length === 0 && <div className="dm text-sm px-5 pb-5" style={{ color: C.inkSoft }}>Nothing yet — start the first one.</div>}
      {theirThreads.map(t => (
        <button key={t.id} onClick={() => onOpenThread(t)} className="thread-row w-full text-left px-5 py-3" style={{ borderTop: "1px solid " + C.line }}>
          <div className="sg font-semibold text-sm" style={{ color: C.ink }}>{t.title}</div>
          <div className="dm text-xs mt-0.5" style={{ color: C.inkSoft }}>{t.replies.length} replies · {timeAgo(t.createdAt)}</div>
        </button>
      ))}
    </div>
  );
}

/* ---------------- Private messages ---------------- */
function MessagesView({ data, currentUser, activePeerId, setActivePeerId, sendMessage, onBack }) {
  const [text, setText] = useState("");
  const [chatErr, setChatErr] = useState("");
  const [sending, setSending] = useState(false);
  const chatFileRef = useRef(null);
  const endRef = useRef(null);
  const convoKey = (a, b) => [a, b].sort().join("|");

  const myConvos = data.conversations.filter(c => c.between.includes(currentUser.id));
  const peers = myConvos.map(c => {
    const pid = c.between.find(x => x !== currentUser.id);
    return { peer: data.users.find(u => u.id === pid), convo: c };
  }).filter(x => x.peer);

  const activeConvo = activePeerId ? data.conversations.find(c => c.key === convoKey(currentUser.id, activePeerId)) : null;
  const activePeer = activePeerId ? data.users.find(u => u.id === activePeerId) : null;

  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [activeConvo?.items?.length, activePeerId]);

  const send = async () => {
    if (!text.trim() || !activePeerId || sending) return;
    const msg = text.trim();
    setText(""); setChatErr(""); setSending(true);
    try { await sendMessage(activePeerId, { text: msg }); }
    catch (ex) { setChatErr(ex.message); setText(msg); }
    setSending(false);
  };

  const sendPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (chatFileRef.current) chatFileRef.current.value = "";
    if (!file || !activePeerId) return;
    setChatErr(""); setSending(true);
    try {
      const img = await compressImage(file, 800, 0.65);
      await sendMessage(activePeerId, { img });
    } catch (ex) { setChatErr(ex.message); }
    setSending(false);
  };

  return (
    <div className="fadein rounded-xl bg-white overflow-hidden flex" style={{ border: "1px solid " + C.line, minHeight: 480 }}>
      <div className={"w-full sm:w-64 shrink-0 flex-col " + (activePeerId ? "hidden sm:flex" : "flex")} style={{ borderRight: "1px solid " + C.line }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid " + C.line, background: C.paper }}>
          <span className="sg font-bold text-sm" style={{ color: C.ink }}>Private chats</span>
          <button onClick={onBack} className="dm text-xs font-semibold" style={{ color: C.teal }}>← Forum</button>
        </div>
        {peers.length === 0 && <div className="dm text-xs p-4 leading-relaxed" style={{ color: C.inkSoft }}>No chats yet. Open any member's profile or post and tap "Message privately".</div>}
        {peers.map(({ peer, convo }) => {
          const last = convo.items[convo.items.length - 1];
          return (
            <button key={peer.id} onClick={() => setActivePeerId(peer.id)} className="thread-row flex items-center gap-2.5 px-4 py-3 text-left"
              style={{ borderBottom: "1px solid " + C.line, background: activePeerId === peer.id ? C.tealTint : undefined }}>
              <Avatar user={peer} size={34} />
              <div className="min-w-0">
                <div className="sg text-sm font-semibold truncate" style={{ color: C.ink }}>{peer.displayName}</div>
                {last && <div className="dm text-[11px] truncate" style={{ color: C.inkSoft }}>{last.img ? "📷 Photo" : last.text}</div>}
              </div>
            </button>
          );
        })}
      </div>
      <div className={"flex-1 flex-col " + (activePeerId ? "flex" : "hidden sm:flex")}>
        {activePeer ? (
          <>
            <div className="px-4 py-3 flex items-center gap-2.5" style={{ borderBottom: "1px solid " + C.line, background: C.paper }}>
              <button onClick={() => setActivePeerId(null)} className="sm:hidden dm text-xs font-semibold" style={{ color: C.teal }}>←</button>
              <Avatar user={activePeer} size={30} />
              <span className="sg font-semibold text-sm" style={{ color: C.ink }}>{activePeer.displayName}</span>
              <span className="dm text-xs" style={{ color: C.inkSoft }}>· {activePeer.borough}</span>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2" style={{ maxHeight: 380 }}>
              {(activeConvo?.items || []).map(m => {
                const mine = m.from === currentUser.id;
                return (
                  <div key={m.id} className={"flex " + (mine ? "justify-end" : "justify-start")}>
                    <div className="dm text-sm px-3 py-2 rounded-2xl max-w-[78%] leading-relaxed"
                      style={mine ? { background: C.teal, color: "#fff", borderBottomRightRadius: 4 } : { background: C.paper, color: C.ink, border: "1px solid " + C.line, borderBottomLeftRadius: 4 }}>
                      {m.img ? <img src={m.img} alt="shared photo" className="rounded-lg block" style={{ maxWidth: 220, maxHeight: 220 }} /> : m.text}
                      <div className="text-[10px] mt-1 opacity-60">{timeAgo(m.at)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            <div className="px-4 py-3" style={{ borderTop: "1px solid " + C.line }}>
              <div className="flex gap-2">
                <input ref={chatFileRef} type="file" accept="image/*" className="hidden" onChange={sendPhoto} />
                <button onClick={() => chatFileRef.current?.click()} aria-label="Send a photo"
                  className="rounded-lg px-2.5" style={{ border: "1px solid " + C.line, background: C.tealTint }}>📷</button>
                <input className={inputCls} style={inputStyle} value={text} onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && send()} placeholder={"Message " + activePeer.displayName + "..."} />
                <Btn small onClick={send} disabled={sending || !text.trim()}>{sending ? "…" : "Send"}</Btn>
              </div>
              {chatErr && <div className="dm text-xs mt-1.5 font-medium" style={{ color: C.red }}>{chatErr}</div>}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center dm text-sm p-6 text-center" style={{ color: C.inkSoft }}>Select a chat to start messaging.</div>
        )}
      </div>
    </div>
  );
}

/* ================= MAIN APP ================= */
export default function NYCSidewalkForum() {
  const [data, setData] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState({ name: "home" });
  const [showAuth, setShowAuth] = useState(false);
  const [showLead, setShowLead] = useState(false);
  const [activePeerId, setActivePeerId] = useState(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("latest");
  const [activeCat, setActiveCat] = useState("all");
  const [loadErr, setLoadErr] = useState("");

  /* ---- load + reload from API ---- */
  const reload = async () => {
    try {
      const state = await api("state");
      setData(state);
      setCurrentUser(state.me);
      setLoadErr("");
    } catch (e) { setLoadErr(e.message); }
  };

  useEffect(() => {
    reload();
    const poll = setInterval(reload, 20000); // light polling keeps chats & replies fresh
    return () => clearInterval(poll);
  }, []);

  const handleAuth = async (user) => {
    setCurrentUser(user);
    setShowAuth(false);
    await reload();
  };

  const logout = async () => {
    try { await api("logout", {}); } catch (e) {}
    setToken(null);
    setCurrentUser(null);
    setView({ name: "home" });
    await reload();
  };

  /* ---- actions (API + refresh) ---- */
  const actions = {
    toggleLike: async (targetId) => {
      try { await api("like", { targetId }); await reload(); } catch (e) { console.error(e); }
    },
    postReply: async (threadId, body, media) => {
      try { await api("reply", { threadId, body, media }); await reload(); } catch (e) { alert(e.message); }
    },
  };

  const sendMessage = async (toUserId, payload) => {
    await api("message", { toUserId, ...payload });
    await reload();
  };

  const openThread = (t) => {
    api("view", { threadId: t.id }).catch(() => {});
    setData(prev => prev ? { ...prev, threads: prev.threads.map(x => x.id === t.id ? { ...x, views: x.views + 1 } : x) } : prev);
    setView({ name: "thread", id: t.id });
  };

  const openCategory = (catId) => {
    setActiveCat(catId);
    setQuery("");
    setView({ name: "home" });
  };

  const startMessage = (user) => {
    if (!currentUser) return setShowAuth(true);
    setActivePeerId(user.id);
    setView({ name: "messages" });
  };

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ background: C.paper }}>
        <style>{FONT_CSS}</style>
        <div className="sg font-semibold" style={{ color: C.teal }}>{loadErr ? "Couldn't reach the forum" : "Loading the forum…"}</div>
        {loadErr && <>
          <div className="dm text-xs" style={{ color: C.inkSoft }}>{loadErr}</div>
          <Btn small onClick={reload}>Try again</Btn>
        </>}
      </div>
    );
  }

  /* ---- derived thread list ---- */
  const q = query.trim().toLowerCase();
  let list = data.threads.filter(t =>
    (activeCat === "all" || t.categoryId === activeCat) &&
    (!q || t.title.toLowerCase().includes(q) || t.body.toLowerCase().includes(q) ||
      t.replies.some(r => r.body.toLowerCase().includes(q)))
  );
  const lastActivity = t => Math.max(t.createdAt, ...t.replies.map(r => r.createdAt));
  if (sort === "latest") list.sort((a, b) => lastActivity(b) - lastActivity(a));
  if (sort === "popular") list.sort((a, b) => (b.likes.length * 3 + b.replies.length * 2 + b.views * 0.05) - (a.likes.length * 3 + a.replies.length * 2 + a.views * 0.05));
  if (sort === "unanswered") list = list.filter(t => t.replies.length === 0).sort((a, b) => b.createdAt - a.createdAt);
  list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  const currentThread = view.name === "thread" ? data.threads.find(t => t.id === view.id) : null;
  const profileUser = view.name === "profile" ? data.users.find(u => u.id === view.id) : null;
  const memberCount = data.users.length;
  const postCount = data.threads.reduce((n, t) => n + 1 + t.replies.length, 0);

  return (
    <div className="min-h-screen dm" style={{ background: C.paper, color: C.ink }}>
      <style>{FONT_CSS}</style>

      {/* ---------- Header ---------- */}
      <header className="flagline sticky top-0 z-40" style={{ background: C.tealDeep, borderBottom: "3px solid " + C.gold }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <button onClick={() => { setView({ name: "home" }); setActiveCat("all"); }} className="flex items-center gap-2.5 text-left">
            <div className="sg flex items-center justify-center rounded-lg font-bold" style={{ width: 38, height: 38, background: C.gold, color: C.tealDeep, fontSize: 17 }}>NY</div>
            <div>
              <div className="sg font-bold text-white leading-none" style={{ fontSize: 17 }}>NYC Sidewalk Forum</div>
              <div className="dm text-[10px] tracking-wide mt-0.5" style={{ color: "#9FC2C9" }}>Violations · Repairs · Permits · All 5 boroughs</div>
            </div>
          </button>
          <div className="flex-1" />
          <div className="hidden md:block relative">
            <input value={query} onChange={e => { setQuery(e.target.value); if (view.name !== "home") setView({ name: "home" }); }}
              placeholder="Search discussions…" className="dm rounded-lg pl-8 pr-3 py-1.5 text-sm w-60"
              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }} />
            <span className="absolute left-2.5 top-1.5 text-sm" style={{ color: "#9FC2C9" }}>⌕</span>
          </div>
          {currentUser ? (
            <div className="flex items-center gap-2">
              <Btn small kind="gold" onClick={() => setView({ name: "new" })}>+ New post</Btn>
              <Btn small kind="ghost" style={{ borderColor: "rgba(255,255,255,0.25)", color: "#fff" }} onClick={() => setView({ name: "messages" })}>Chats</Btn>
              <button onClick={() => setView({ name: "profile", id: currentUser.id })}><Avatar user={currentUser} size={32} /></button>
              <button onClick={logout} className="dm text-[11px] font-medium" style={{ color: "#9FC2C9" }}>Log out</button>
            </div>
          ) : (
            <Btn small kind="gold" onClick={() => setShowAuth(true)}>Log in / Sign up</Btn>
          )}
        </div>
      </header>

      {/* ---------- Body ---------- */}
      {(() => { const isHome = view.name === "home"; return (
      <main className={"mx-auto px-4 py-5 items-start " + (isHome
        ? "max-w-6xl grid grid-cols-1 lg:grid-cols-[230px_1fr_260px] gap-5"
        : "max-w-3xl")}>

        {/* Left: categories (home only) */}
        {isHome && (
        <aside className="rounded-xl bg-white overflow-hidden order-2 lg:order-1" style={{ border: "1px solid " + C.line }}>
          <div className="sg px-4 py-3 text-xs font-bold tracking-widest" style={{ color: C.inkSoft, letterSpacing: "0.12em", borderBottom: "1px solid " + C.line }}>CATEGORIES</div>
          <button onClick={() => { setActiveCat("all"); setView({ name: "home" }); }} className="thread-row w-full text-left px-4 py-2.5 dm text-sm font-medium"
            style={{ color: activeCat === "all" ? C.teal : C.ink, background: activeCat === "all" ? C.tealTint : undefined }}>
            All discussions
          </button>
          {CATEGORIES.map(c => {
            const count = data.threads.filter(t => t.categoryId === c.id).length;
            return (
              <button key={c.id} onClick={() => { setActiveCat(c.id); setView({ name: "home" }); }} className="thread-row w-full text-left px-4 py-2.5 flex items-center gap-2"
                style={{ background: activeCat === c.id ? C.tealTint : undefined, borderTop: "1px solid " + C.line }}>
                <span className="sg text-xs w-5 text-center" style={{ color: C.teal }}>{c.icon}</span>
                <span className="dm text-[13px] font-medium flex-1" style={{ color: activeCat === c.id ? C.teal : C.ink }}>{c.name}</span>
                <span className="dm text-[11px]" style={{ color: C.inkSoft }}>{count}</span>
              </button>
            );
          })}
          <div className="px-4 py-3 dm text-[11px] leading-relaxed" style={{ color: C.inkSoft, borderTop: "1px solid " + C.line, background: C.paper }}>
            {memberCount} members · {postCount} posts and growing
          </div>
        </aside>
        )}

        {/* Center: main view */}
        <section className={isHome ? "order-1 lg:order-2 min-w-0" : "min-w-0"}>
          {isHome && (
          <div className="md:hidden mb-3">
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search discussions…" className={inputCls} style={inputStyle} />
          </div>
          )}

          {view.name === "home" && (
            <>
              {activeCat === "all" && !q && (
                <div className="fadein grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                  {CATEGORIES.map(c => {
                    const count = data.threads.filter(t => t.categoryId === c.id).length;
                    return (
                      <button key={c.id} onClick={() => openCategory(c.id)}
                        className="thread-row text-left rounded-xl bg-white px-3 py-3 transition-colors"
                        style={{ border: "1px solid " + C.line }}>
                        <div className="sg text-base mb-1" style={{ color: C.teal }}>{c.icon}</div>
                        <div className="sg font-semibold text-[13px] leading-snug" style={{ color: C.ink }}>{c.name}</div>
                        <div className="dm text-[11px] mt-0.5" style={{ color: C.inkSoft }}>{count} discussion{count === 1 ? "" : "s"}</div>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="fadein rounded-xl bg-white overflow-hidden" style={{ border: "1px solid " + C.line }}>
              <div className="px-4 py-3 flex items-center gap-2 flex-wrap" style={{ borderBottom: "1px solid " + C.line, background: C.paper }}>
                <h2 className="sg font-bold text-sm flex-1" style={{ color: C.ink }}>
                  {activeCat === "all" ? "All discussions" : CATEGORIES.find(c => c.id === activeCat)?.name}
                  {q && <span className="dm font-normal" style={{ color: C.inkSoft }}> · results for “{query}”</span>}
                </h2>
                {["latest", "popular", "unanswered"].map(s => (
                  <button key={s} onClick={() => setSort(s)} className="sg text-[11px] font-semibold px-2.5 py-1 rounded-md capitalize"
                    style={sort === s ? { background: C.teal, color: "#fff" } : { color: C.inkSoft, border: "1px solid " + C.line }}>
                    {s}
                  </button>
                ))}
              </div>
              {activeCat !== "all" && (
                <div className="dm text-xs px-4 py-2.5 flex items-center justify-between gap-2" style={{ color: C.inkSoft, borderBottom: "1px solid " + C.line }}>
                  <span>{CATEGORIES.find(c => c.id === activeCat)?.desc}</span>
                  <button onClick={() => openCategory("all")} className="sg text-[11px] font-semibold shrink-0" style={{ color: C.teal }}>All categories →</button>
                </div>
              )}
              {list.length === 0 && (
                <div className="text-center py-12 px-6">
                  <div className="sg font-bold mb-1" style={{ color: C.ink }}>Nothing here yet</div>
                  <p className="dm text-sm mb-4" style={{ color: C.inkSoft }}>Be the first to ask — the community answers fast.</p>
                  <Btn onClick={() => currentUser ? setView({ name: "new" }) : setShowAuth(true)}>Start a discussion</Btn>
                </div>
              )}
              {list.map(t => (
                <ThreadRow key={t.id} thread={t} data={data} onOpen={() => openThread(t)}
                  onOpenProfile={u => u && setView({ name: "profile", id: u.id })}
                  onOpenCategory={openCategory} />
              ))}
            </div>
            </>
          )}

          {view.name === "new" && (
            <NewThread data={data} currentUser={currentUser} defaultCat={activeCat !== "all" ? activeCat : undefined}
              onCancel={() => setView({ name: "home" })}
              onCreate={async f => {
                try {
                  const r = await api("thread", { categoryId: f.categoryId, title: f.title, body: f.body, media: f.media });
                  await reload();
                  setView({ name: "thread", id: r.id });
                } catch (e) { alert(e.message); }
              }} />
          )}

          {view.name === "thread" && currentThread && (
            <>
            <ThreadView thread={currentThread} data={data} currentUser={currentUser}
              onBack={() => setView({ name: "home" })} requireAuth={() => setShowAuth(true)} actions={actions}
              onOpenProfile={u => u && setView({ name: "profile", id: u.id })} onMessage={startMessage}
              onOpenCategory={openCategory} />
            <div className="flagline mt-4 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap" style={{ background: C.tealDeep }}>
              <div className="min-w-0 flex-1">
                <div className="sg text-sm font-bold text-white">Dealing with this yourself? Get a free estimate.</div>
                <div className="dm text-[11px]" style={{ color: "#9FC2C9" }}>Eden Contractors NY · Licensed & insured · All 5 boroughs</div>
              </div>
              <Btn small kind="gold" onClick={() => setShowLead(true)}>Free estimate</Btn>
            </div>
            </>
          )}

          {view.name === "profile" && profileUser && (
            <ProfileView user={profileUser} data={data} currentUser={currentUser}
              onBack={() => setView({ name: "home" })} onOpenThread={openThread} onMessage={startMessage}
              onSaveBio={async bio => { try { await api("profile", { bio }); await reload(); } catch (e) { alert(e.message); } }} />
          )}

          {view.name === "messages" && (currentUser ? (
            <MessagesView data={data} currentUser={currentUser} activePeerId={activePeerId}
              setActivePeerId={setActivePeerId} sendMessage={sendMessage} onBack={() => setView({ name: "home" })} />
          ) : (
            <div className="rounded-xl bg-white p-8 text-center" style={{ border: "1px solid " + C.line }}>
              <p className="dm text-sm mb-3" style={{ color: C.inkSoft }}>Log in to use private chats.</p>
              <Btn onClick={() => setShowAuth(true)}>Log in / Sign up</Btn>
            </div>
          ))}
        </section>

        {/* Right: sponsor + community (home only) */}
        {isHome && (
        <aside className="order-3 space-y-4">
          <EstimateCTA onLead={() => setShowLead(true)} />
          <div className="rounded-xl bg-white overflow-hidden" style={{ border: "1px solid " + C.line }}>
            <div className="sg px-4 py-3 text-xs font-bold tracking-widest" style={{ color: C.inkSoft, letterSpacing: "0.12em", borderBottom: "1px solid " + C.line }}>ACTIVE MEMBERS</div>
            {data.users.slice(0, 6).map(u => (
              <button key={u.id} onClick={() => setView({ name: "profile", id: u.id })} className="thread-row w-full flex items-center gap-2.5 px-4 py-2.5 text-left" style={{ borderTop: "1px solid " + C.line }}>
                <Avatar user={u} size={30} />
                <div className="min-w-0">
                  <div className="dm text-[13px] font-semibold truncate" style={{ color: C.ink }}>{u.displayName}</div>
                  <div className="dm text-[11px]" style={{ color: C.inkSoft }}>{u.borough}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="rounded-xl px-4 py-4" style={{ background: C.goldSoft, border: "1px solid #EAD79A" }}>
            <div className="sg text-xs font-bold mb-1" style={{ color: "#7A6210" }}>QUICK TIP</div>
            <p className="dm text-xs leading-relaxed" style={{ color: "#5C4D10" }}>
              DOT violations have no fine attached — but ignore one and the city can repair your sidewalk and bill you at its own rates, then place a lien. Get quotes early.
            </p>
          </div>
        </aside>
        )}
      </main>
      ); })()}

      <footer className="dm text-center text-[11px] py-6" style={{ color: C.inkSoft }}>
        NYC Sidewalk Forum · Community sponsored by Eden Contractors NY · Not affiliated with NYC DOT
      </footer>

      {showAuth && <AuthModal data={data} onClose={() => setShowAuth(false)} onAuth={handleAuth} />}
      {showLead && <LeadModal currentUser={currentUser} onClose={() => setShowLead(false)} />}
    </div>
  );
}
