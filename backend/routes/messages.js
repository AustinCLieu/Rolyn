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
  const { post_id, content, receiver_id: explicitReceiver } = req.body;
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

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(post_id);
  if (!post) {
    return res.status(404).json({ error: 'Listing not found.' });
  }

  let receiver_id;

  if (explicitReceiver) {
    // The post owner is replying to someone who messaged them. They pass receiver_id
    // explicitly because the backend can't derive it from the post (they ARE the post owner).
    // We enforce that only the post owner can use this path — otherwise any user could
    // send a message to an arbitrary person by spoofing receiver_id.
    if (post.user_id !== sender_id) {
      return res.status(403).json({ error: 'Only the listing owner can specify a receiver.' });
    }
    if (explicitReceiver === sender_id) {
      return res.status(400).json({ error: 'You cannot message yourself.' });
    }
    receiver_id = explicitReceiver;
  } else {
    // No explicit receiver — this is an initial message from the listing page.
    // Derive receiver from the post owner and block self-messaging.
    if (post.user_id === sender_id) {
      return res.status(400).json({ error: 'You cannot message your own listing.' });
    }
    receiver_id = post.user_id;
  }

  const result = db.prepare(`
    INSERT INTO messages (post_id, sender_id, receiver_id, content)
    VALUES (?, ?, ?, ?)
  `).run(post_id, sender_id, receiver_id, content.trim());

  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(message);
});

// GET /api/messages — inbox for the logged-in user.
// Returns one entry per conversation (unique post + other person pair), sorted by
// most recent message. Each entry includes the last message preview, unread count,
// the post title, and the other person's display name.
//
// The subquery pre-computes other_user_id (whoever isn't the logged-in user in each
// message row) so the outer query can GROUP BY it cleanly without repeating the
// CASE expression multiple times.
router.get('/', requireAuth, (req, res) => {
  const userId = req.user.id;

  const threads = db.prepare(`
    SELECT
      post_id,
      other_user_id,
      MAX(created_at)  AS last_message_at,
      content          AS last_content,
      sender_id        AS last_sender_id,
      SUM(CASE WHEN receiver_id = ? AND read = 0 THEN 1 ELSE 0 END) AS unread_count
    FROM (
      SELECT *,
        CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS other_user_id
      FROM messages
      WHERE sender_id = ? OR receiver_id = ?
    )
    GROUP BY post_id, other_user_id
    ORDER BY last_message_at DESC
  `).all(userId, userId, userId, userId);

  // Enrich each thread with the post title and the other user's display name.
  // We do this in JS rather than a giant JOIN so the SQL stays readable.
  const inbox = threads.map((thread) => {
    const post      = db.prepare('SELECT id, title FROM posts WHERE id = ?').get(thread.post_id);
    const otherUser = db.prepare('SELECT id, full_name, email FROM users WHERE id = ?').get(thread.other_user_id);
    return {
      ...thread,
      post_title:      post?.title      ?? 'Deleted listing',
      other_user_name: otherUser?.full_name ?? otherUser?.email?.split('@')[0] ?? 'Unknown user',
    };
  });

  res.json(inbox);
});

// PATCH /api/messages/:id/read — mark a single message as read.
// Only the receiver can mark it read — the sender already knows what they wrote.
// We check ownership before updating so one user can't clear another user's unread flag.
router.patch('/:id/read', requireAuth, (req, res) => {
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
  if (!message) return res.status(404).json({ error: 'Message not found.' });
  if (message.receiver_id !== req.user.id) return res.status(403).json({ error: 'Only the recipient can mark a message as read.' });

  db.prepare('UPDATE messages SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/messages/:postId/:userId — full message thread between the logged-in user
// and one other user about one specific post, in chronological order (oldest first).
// Both sides of the conversation (sent and received) are included.
router.get('/:postId/:userId', requireAuth, (req, res) => {
  const myId      = req.user.id;
  const otherUser = req.params.userId;
  const postId    = Number(req.params.postId);

  const messages = db.prepare(`
    SELECT * FROM messages
    WHERE post_id = ?
      AND (
        (sender_id = ? AND receiver_id = ?) OR
        (sender_id = ? AND receiver_id = ?)
      )
    ORDER BY created_at ASC
  `).all(postId, myId, otherUser, otherUser, myId);

  res.json(messages);
});

export default router;
