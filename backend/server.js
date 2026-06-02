import express    from 'express';
import cors       from 'cors';
import dotenv     from 'dotenv';
import path       from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync }  from 'node:sqlite'; // built into Node 22+, no install needed
import authRouter from './routes/auth.js';

dotenv.config();

// __dirname isn't available in ES modules, so we derive it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Database setup ──
// DatabaseSync opens (or creates) a .db file at the given path.
// No external package needed — node:sqlite is built into Node.js.
const db = new DatabaseSync(path.join(__dirname, 'rolyn.db'));

// Create the posts table on first run (IF NOT EXISTS makes it safe to run every time)
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT,
    author_name TEXT    NOT NULL DEFAULT 'Anonymous',
    title       TEXT    NOT NULL,
    category    TEXT    NOT NULL,
    description TEXT    NOT NULL,
    region      TEXT    NOT NULL,
    term        TEXT    NOT NULL,
    price_min   INTEGER,
    price_max   INTEGER,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`);

// ── Express app ──
const app = express();
app.use(cors());
app.use(express.json());

// Auth routes (existing — untouched)
app.use('/api/auth', authRouter);

// ── Posts routes ──

// GET /api/posts — list all active posts, newest first
// Optional query params: ?category=cleaning&region=manila&term=weekly
app.get('/api/posts', (req, res) => {
  const { category, region, term } = req.query;

  let sql      = 'SELECT * FROM posts WHERE active = 1';
  const params = [];

  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (region)   { sql += ' AND region = ?';   params.push(region);   }
  if (term)     { sql += ' AND term = ?';      params.push(term);     }

  sql += ' ORDER BY created_at DESC';

  // db.prepare() compiles the SQL once; .all() runs it and returns every row as an object
  const posts = db.prepare(sql).all(...params);
  res.json(posts);
});

// GET /api/posts/:id — fetch a single post by id
app.get('/api/posts/:id', (req, res) => {
  // .get() returns one row as an object, or undefined if not found
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  res.json(post);
});

// POST /api/posts — create a new post
app.post('/api/posts', (req, res) => {
  const { user_id, author_name, title, category, description, region, term, price_min, price_max } = req.body;

  if (!title || !category || !description || !region || !term) {
    return res.status(400).json({ error: 'Please fill in all required fields.' });
  }
  if (title.length > 120) {
    return res.status(400).json({ error: 'Title must be 120 characters or fewer.' });
  }
  if (description.length > 2000) {
    return res.status(400).json({ error: 'Description must be 2000 characters or fewer.' });
  }

  // .run() executes an INSERT/UPDATE/DELETE and returns { lastInsertRowid, changes }
  const result = db.prepare(`
    INSERT INTO posts (user_id, author_name, title, category, description, region, term, price_min, price_max)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user_id     ?? null,
    author_name ?? 'Anonymous',
    title,
    category,
    description,
    region,
    term,
    price_min ? Number(price_min) : null,
    price_max ? Number(price_max) : null,
  );

  // Fetch the full row we just inserted using the auto-generated id
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(post);
});

// PATCH /api/posts/:id/close — mark a post as closed without deleting it
app.patch('/api/posts/:id/close', (req, res) => {
  const result = db.prepare('UPDATE posts SET active = 0 WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Post not found.' });
  res.json({ success: true });
});

// DELETE /api/posts/:id — permanently delete a post
app.delete('/api/posts/:id', (req, res) => {
  const result = db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Post not found.' });
  res.json({ success: true });
});

// ── Health check ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ── Start server ──
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server on http://localhost:${PORT}`);
});