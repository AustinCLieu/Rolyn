import express         from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { db }          from '../db.js';

const router = express.Router();

// POST /api/messages — send a message about a listing.
// Requires login. Body: { post_id, content }
//
// We look up the post to find who owns it (receiver_id). This means the sender
// never has to know or send the receiver's user_id themselves — the backend
// derives it from the post, which prevents spoofing the receiver.
router.post('/', requireAuth, (req, res) => {
  const { post_id, content } = req.body;
  const sender_id = req.user.id;

  if (!post_id) {
    return res.status(400).json({ error: 'post_id is required.' });
  }
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Message content cannot be empty.' });
  }
  if (content.trim().length > 2000) {
    return res.status(400).json({ error: 'Message must be 2000 characters or fewer.' });
  }

  // Look up the post to find the receiver.
  // If the post doesn't exist or is closed, we reject the message — no point
  // messaging about a listing that's no longer active.
  const post = db.prepare('SELECT * FROM posts WHERE id = ? AND active = 1').get(post_id);
  if (!post) {
    return res.status(404).json({ error: 'Listing not found or is no longer active.' });
  }

  // Prevent users from messaging themselves (i.e. messaging their own listing).
  if (post.user_id === sender_id) {
    return res.status(400).json({ error: 'You cannot message your own listing.' });
  }

  const receiver_id = post.user_id;

  const result = db.prepare(`
    INSERT INTO messages (post_id, sender_id, receiver_id, content)
    VALUES (?, ?, ?, ?)
  `).run(post_id, sender_id, receiver_id, content.trim());

  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(message);
});

export default router;
