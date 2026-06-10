-- NYC Sidewalk Forum — D1 schema + seed content
-- Run with: npx wrangler d1 execute forum-db --remote --file=schema.sql

DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS threads;
DROP TABLE IF EXISTS replies; DROP TABLE IF EXISTS likes; DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS leads;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  borough TEXT NOT NULL,
  bio TEXT DEFAULT '',
  avatar_color TEXT NOT NULL,
  pass_hash TEXT,
  salt TEXT,
  joined INTEGER NOT NULL,
  seed INTEGER DEFAULT 0
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created INTEGER NOT NULL
);

CREATE TABLE threads (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author_id TEXT NOT NULL,
  created INTEGER NOT NULL,
  views INTEGER DEFAULT 0,
  pinned INTEGER DEFAULT 0,
  media TEXT DEFAULT '[]'
);

CREATE TABLE replies (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created INTEGER NOT NULL,
  media TEXT DEFAULT '[]'
);
CREATE INDEX idx_replies_thread ON replies(thread_id);

CREATE TABLE likes (
  user_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  PRIMARY KEY (user_id, target_id)
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  text TEXT,
  img TEXT,
  created INTEGER NOT NULL
);
CREATE INDEX idx_messages_from ON messages(from_id);
CREATE INDEX idx_messages_to ON messages(to_id);

CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  borough TEXT,
  detail TEXT,
  created INTEGER NOT NULL
);

-- ---------- Seed members (cannot log in: no password) ----------
INSERT INTO users (id, username, display_name, borough, bio, avatar_color, joined, seed) VALUES
('seed-marisol_bk','marisol_bk','Marisol R.','Brooklyn','Brownstone owner in Bed-Stuy. Learned about sidewalks the hard way.','#0B5D6A',(unixepoch()-90*86400)*1000,1),
('seed-tony_queens','tony_queens','Tony G.','Queens','Property manager, 14 buildings in Astoria & LIC.','#8A5A2B',(unixepoch()-83*86400)*1000,1),
('seed-priya_bx','priya_bx','Priya S.','Bronx','First-time homeowner figuring it all out.','#5B3D8A',(unixepoch()-76*86400)*1000,1),
('seed-eden_team','eden_team','Eden Contractors NY','Queens','Licensed & insured NYC sidewalk repair specialists. DOT violation removal, free estimates.','#2E7D52',(unixepoch()-69*86400)*1000,1),
('seed-walkny_dan','walkny_dan','Dan M.','Manhattan','Retired concrete finisher, 30 years in the trade.','#A4452F',(unixepoch()-62*86400)*1000,1),
('seed-staceySI','staceysi','Stacey W.','Staten Island','Two-family homeowner near Great Kills.','#1F5F8B',(unixepoch()-55*86400)*1000,1);

-- ---------- Seed threads ----------
INSERT INTO threads (id, category_id, title, body, author_id, created, views, pinned) VALUES
('t1','violations','Welcome! Read this first — how this forum works','Welcome to the NYC Sidewalk Forum, a free community for NYC homeowners and property managers dealing with sidewalk repairs, DOT violations, permits and contractors.

House rules:
1. Be helpful and specific — mention your borough when asking.
2. No spam. Contractors may answer questions but hard-selling gets removed.
3. Never share full addresses publicly. Use the private chat for that.

This community is sponsored by Eden Contractors NY — licensed NYC sidewalk specialists. If you need a fast, free estimate for a violation or repair, hit the gold button any time. Otherwise, ask away — the community is here to help.','seed-eden_team',(unixepoch()-60*86400)*1000,1843,1),
('t2','violations','Just received a DOT sidewalk violation — what happens if I ignore it?','Found an orange notice taped to my door in Bed-Stuy yesterday. It says I have a defective sidewalk flag and references Section 19-152. Honestly tempted to ignore it since there is no fine amount listed. What actually happens if I do nothing?','seed-marisol_bk',(unixepoch()-12*86400)*1000,462,0),
('t3','costs','What is a fair price per flag in Queens right now (2026)?','Getting wildly different quotes for replacing 6 sidewalk flags in Astoria — from $2,100 all the way to $5,800. Same scope. What are people actually paying per 5x5 flag this year?','seed-tony_queens',(unixepoch()-6*86400)*1000,388,0),
('t4','trees','City tree destroyed my sidewalk — am I really on the hook?','Huge oak (city-owned, it has a tree pit) lifted three flags in front of my place in the Bronx by a good 2 inches. Trip hazard for sure. Is this my responsibility or the Parks Department?','seed-priya_bx',(unixepoch()-9*86400)*1000,521,0),
('t5','permits','Do I need a DOT permit to fix my own sidewalk?','Handy homeowner here in Staten Island. The crack is in one flag. Can I legally re-pour it myself, and do I still need a permit?','seed-staceySI',(unixepoch()-4*86400)*1000,240,0),
('t6','contractors','Red flags when hiring a sidewalk contractor?','About to sign with a contractor for a $7k sidewalk + curb job in Manhattan. What should I check before handing over a deposit?','seed-walkny_dan',(unixepoch()-2*86400)*1000,176,0),
('t7','curbs','Driveway apron crumbling — concrete or asphalt?','My driveway apron in Queens is crumbling at the curb line. Contractor says it must be 7-inch concrete by code, my neighbor says he did asphalt. Who is right?','seed-tony_queens',(unixepoch()-1*86400)*1000,88,0);

-- ---------- Seed replies ----------
INSERT INTO replies (id, thread_id, author_id, body, created) VALUES
('r1','t1','seed-marisol_bk','Great idea for a forum. Wish this existed when I got my first violation notice.',(unixepoch()-60*86400+5400)*1000),
('r2','t1','seed-tony_queens','Bookmarked. Sending my super here next time he panics over a DOT letter.',(unixepoch()-60*86400+10800)*1000),
('r3','t2','seed-walkny_dan','Do not ignore it. There is no immediate fine, but the city can send its own contractor to do the repair and bill you — usually at a much higher rate than a private contractor — and unpaid bills become a lien on the property.',(unixepoch()-12*86400+5400)*1000),
('r4','t2','seed-eden_team','Dan is right. The violation also shows up in title searches, so it complicates refinancing or selling. Typical flow: violation issued, you have 75 days, then the city may repair and bill you. A private repair with a DOT permit is almost always cheaper. Happy to look at the notice — message us, no charge for an assessment.',(unixepoch()-12*86400+10800)*1000),
('r5','t2','seed-marisol_bk','That lien part is what I needed to hear. Getting quotes this week, thanks both.',(unixepoch()-12*86400+16200)*1000),
('r6','t3','seed-walkny_dan','Depends on access, thickness (4 inch vs 7 inch at driveways), and whether there is tree root work. For straight 4 inch flags with decent access most reputable shops in Queens are in the $350-$600 per flag range. $5,800 for 6 standard flags is somebody fishing.',(unixepoch()-6*86400+5400)*1000),
('r7','t3','seed-staceySI','Paid $410/flag on Staten Island in March, included haul-away and the DOT permit.',(unixepoch()-6*86400+10800)*1000),
('r8','t3','seed-eden_team','Those ranges match what we see. Watch for quotes that exclude the DOT permit or disposal — that is where lowball numbers sneak up later. Get the permit number in writing before any pour.',(unixepoch()-6*86400+16200)*1000),
('r9','t4','seed-tony_queens','Look up the Trees & Sidewalks Program on the Parks site. One-, two-, and three-family homes can qualify for the city to repair tree-damaged flags for free — but the waitlist is long, sometimes years.',(unixepoch()-9*86400+5400)*1000),
('r10','t4','seed-walkny_dan','And here is the catch: being on the waitlist does not stop DOT from issuing a violation, and it does not protect you if someone trips and sues. A lot of owners do a private repair with root-friendly methods rather than wait.',(unixepoch()-9*86400+10800)*1000),
('r11','t4','seed-priya_bx','Years?! Okay, that explains why my neighbor just paid out of pocket.',(unixepoch()-9*86400+16200)*1000),
('r12','t5','seed-walkny_dan','Yes — any sidewalk construction in NYC needs a DOT sidewalk construction permit, even on your own property line. Homeowners of 1-3 family homes can pull it themselves. The work also has to meet DOT spec: 4 inch concrete over compacted base, 7 inch at driveways, proper expansion joints, scored to match adjacent flags.',(unixepoch()-4*86400+5400)*1000),
('r13','t5','seed-eden_team','Also schedule the dismissal inspection after the work if you are clearing a violation — the repair alone does not close it out. Plenty of DIY repairs fail inspection on finish or flag thickness, so measure twice.',(unixepoch()-4*86400+10800)*1000),
('r14','t6','seed-tony_queens','1) HIC license you can verify with DCWP. 2) Active general liability insurance — ask for the COI naming you as certificate holder. 3) They pull the DOT permit, not you "to save money". 4) Deposit under 30%. 5) Written scope with flag count and thickness.',(unixepoch()-2*86400+5400)*1000),
('r15','t6','seed-eden_team','Solid list. One more: ask for the permit number before the pour and verify it on the DOT permit portal. An unpermitted pour can be ordered ripped out — you pay twice.',(unixepoch()-2*86400+10800)*1000),
('r16','t7','seed-walkny_dan','Your contractor is right for the apron itself — DOT spec calls for 7 inch full-depth concrete at driveways. Asphalt aprons get flagged. Your neighbor is living on borrowed time.',(unixepoch()-1*86400+5400)*1000);
