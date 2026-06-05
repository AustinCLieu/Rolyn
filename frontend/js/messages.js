// messages.js — API helpers for the messaging system.
// Imported by listing.js (send) and profile.js (inbox + thread).

import { api } from './api.js';

// Send a message about a listing. Requires the user to be logged in.
// post_id is the listing being messaged about; the backend looks up the receiver
// from the post itself so the frontend never needs to know the poster's user id.
export async function sendMessage(postId, content) {
  return api.post('/api/messages', { post_id: postId, content });
}

// Fetch the inbox for the logged-in user — one entry per conversation thread.
export async function fetchInbox() {
  return api.get('/api/messages');
}

// Fetch the full message thread between the logged-in user and one other person
// about a specific post.
export async function fetchThread(postId, otherUserId) {
  return api.get(`/api/messages/${postId}/${otherUserId}`);
}

// Mark a single message as read. Only works if the logged-in user is the receiver.
export async function markRead(messageId) {
  return api.patch(`/api/messages/${messageId}/read`, {});
}
