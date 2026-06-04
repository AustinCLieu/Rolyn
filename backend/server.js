import express    from 'express';
import cors       from 'cors';
import dotenv     from 'dotenv';
import { db }     from './db.js';                          // shared SQLite instance
import authRouter from './routes/auth.js';
import { requireAuth } from './middleware/requireAuth.js'; // JWT gate

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);

// ── Posts routes ──

// GET /api/posts — list active posts, newest first.
// Supports optional filters: ?category=tutoring&region=ncr&term=weekly&user_id=<uuid>
// Supports pagination: ?limit=5&offset=0
// Returns { posts: [...], hasMore: bool } so the frontend knows whether to show "Load more".
app.get('/api/posts', (req, res) => {
  const { category, region, term, user_id } = req.query;

  // Cap limit at 100 so a caller can't accidentally pull the entire table in one shot.
  const limit  = Math.min(Math.max(Number(req.query.limit)  || 20, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  let sql      = 'SELECT * FROM posts WHERE active = 1';
  const params = [];

  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (region)   { sql += ' AND region = ?';   params.push(region);   }
  if (term)     { sql += ' AND term = ?';      params.push(term);     }
  if (user_id)  { sql += ' AND user_id = ?';   params.push(user_id);  }

  sql += ' ORDER BY created_at DESC';

  // Fetch one extra row beyond the limit. If we get limit+1 rows back, there is at
  // least one more page. We then slice it off before sending so the client only gets
  // exactly `limit` rows.
  const rows    = db.prepare(sql + ' LIMIT ? OFFSET ?').all(...params, limit + 1, offset);
  const hasMore = rows.length > limit;
  const posts   = hasMore ? rows.slice(0, limit) : rows;

  res.json({ posts, hasMore });
});

// GET /api/posts/:id — single post, public
app.get('/api/posts/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  res.json(post);
});

// POST /api/posts — create a listing. Requires login.
// We take user_id from the verified JWT (req.user.id), NOT from the request body.
// This prevents a logged-in user from spoofing a different user_id.
app.post('/api/posts', requireAuth, (req, res) => {
  const { author_name, title, category, description, region, term, price_min, price_max } = req.body;

  if (!title || !category || !description || !region || !term) {
    return res.status(400).json({ error: 'Please fill in all required fields.' });
  }
  if (title.length > 120) {
    return res.status(400).json({ error: 'Title must be 120 characters or fewer.' });
  }
  if (description.length > 2000) {
    return res.status(400).json({ error: 'Description must be 2000 characters or fewer.' });
  }

  const result = db.prepare(`
    INSERT INTO posts (user_id, author_name, title, category, description, region, term, price_min, price_max)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id,
    author_name ?? 'Anonymous',
    title,
    category,
    description,
    region,
    term,
    price_min ? Number(price_min) : null,
    price_max ? Number(price_max) : null,
  );

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(post);
});

// PATCH /api/posts/:id/close — mark a post inactive. Requires login and ownership.
app.patch('/api/posts/:id/close', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  if (post.user_id !== req.user.id) return res.status(403).json({ error: 'You do not own this post.' });

  db.prepare('UPDATE posts SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// DELETE /api/posts/:id — permanently delete a post. Requires login and ownership.
app.delete('/api/posts/:id', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  if (post.user_id !== req.user.id) return res.status(403).json({ error: 'You do not own this post.' });

  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── Health check ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server on http://localhost:${PORT}`);
});
