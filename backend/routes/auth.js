// All routes under /api/auth/* live here.
// Login and signup are handled by Supabase on the frontend — this file only deals with
// what happens AFTER the user is authenticated (reading/writing their data in SQLite).

import express           from 'express';
import { requireAuth }   from '../middleware/requireAuth.js';
import { supabase }      from '../lib/supabase.js';
import { db }            from '../db.js';

const router = express.Router();

// GET /api/auth/me — return the verified Supabase user + their SQLite profile row.
// If the user has never been synced yet (e.g. first visit after OAuth redirect), we
// create their SQLite row here so the profile page always gets a non-null profile.
router.get('/me', requireAuth, (req, res) => {
  const { id, email, user_metadata } = req.user;

  // Auto-create the SQLite row if it doesn't exist yet.
  // INSERT OR IGNORE means: do nothing if the row already exists.
  db.prepare(`
    INSERT OR IGNORE INTO users (id, email, full_name, location, phone)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    id,
    email,
    user_metadata?.display_name ?? user_metadata?.full_name ?? null,
    user_metadata?.location ?? null,
    user_metadata?.phone    ?? null,
  );

  const profile = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.json({ user: req.user, profile });
});

// POST /api/auth/sync — upsert the logged-in user into SQLite.
// The frontend calls this right after every login so our SQLite users table stays
// current even when metadata changes (e.g. updated display name via Google account).
//
// ON CONFLICT … DO UPDATE means: if a row with this id already exists, only update
// the email (which can change). We use COALESCE so profile fields the user already
// set in our app (full_name, location, phone) are NOT overwritten by the OAuth metadata.
// COALESCE(users.field, excluded.field) = keep existing value if non-null, else use new.
router.post('/sync', requireAuth, (req, res) => {
  const { id, email, user_metadata } = req.user;

  db.prepare(`
    INSERT INTO users (id, email, full_name, location, phone)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email     = excluded.email,
      full_name = COALESCE(users.full_name, excluded.full_name),
      location  = COALESCE(users.location,  excluded.location),
      phone     = COALESCE(users.phone,     excluded.phone)
  `).run(
    id,
    email,
    user_metadata?.display_name ?? user_metadata?.full_name ?? null,
    user_metadata?.location ?? null,
    user_metadata?.phone    ?? null,
  );

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.json({ user });
});

// PATCH /api/auth/profile — update display name, location, or phone in SQLite.
// Supabase Auth handles email and password changes separately via its own SDK.
// All the personal-profile fields the user can edit on their profile page live here.
router.patch('/profile', requireAuth, (req, res) => {
  const { full_name, location, phone } = req.body;

  if (full_name !== undefined && (!full_name || full_name.trim().length < 2)) {
    return res.status(400).json({ error: 'Display name must be at least 2 characters.' });
  }

  // COALESCE(?, column) means: use the new value if provided, otherwise keep the old one.
  // This lets a single PATCH update only the fields that were sent.
  db.prepare(`
    UPDATE users SET
      full_name = COALESCE(?, full_name),
      location  = COALESCE(?, location),
      phone     = COALESCE(?, phone)
    WHERE id = ?
  `).run(
    full_name?.trim() ?? null,
    location          ?? null,
    phone?.trim()     ?? null,
    req.user.id,
  );

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ profile: updated });
});

// DELETE /api/auth/account — delete the user from Supabase Auth first, then SQLite.
// We delete from Supabase first so that if it fails we haven't lost the SQLite record yet.
// supabase.auth.admin.deleteUser requires the service role key we already have.
router.delete('/account', requireAuth, async (req, res) => {
  const userId = req.user.id;

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    return res.status(500).json({ error: 'Could not remove account from auth service.' });
  }

  // Auth deletion succeeded — now clean up all their data in SQLite.
  db.prepare('DELETE FROM posts WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  res.json({ success: true });
});

export default router;
