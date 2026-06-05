// thread.js — drives the messages.html thread view page.
// Reads ?post=<id>&user=<uuid> from the URL, fetches the conversation,
// marks unread messages as read, and handles the reply form.

import { fetchThread, markRead, sendMessage } from './messages.js';
import { fetchPost, escHtml }                 from './posts.js';
import { getSession }                          from './auth.js';
import { api }                                 from './api.js';

document.addEventListener('DOMContentLoaded', async () => {

  const params      = new URLSearchParams(window.location.search);
  const postId      = params.get('post');
  const otherUserId = params.get('user');

  // Both params are required — without them we don't know which thread to load.
  if (!postId || !otherUserId) {
    window.location.href = 'profile.html';
    return;
  }

  // Require login — threads are private.
  const { data } = await getSession();
  const user = data?.session?.user ?? null;
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  const myId = user.id;

  // Fetch post info, other user's display name, and messages in parallel so
  // we don't wait for each one sequentially.
  const [post, otherUser, messages] = await Promise.all([
    fetchPost(postId).catch(() => null),
    api.get(`/api/users/${encodeURIComponent(otherUserId)}`).catch(() => null),
    fetchThread(postId, otherUserId).catch(() => []),
  ]);

  // Populate the thread header.
  const postTitle  = post?.title ?? 'Deleted listing';
  const otherName  = otherUser?.name ?? 'Unknown user';
  document.title   = `${otherName} — Messages — Rolyn`;
  document.getElementById('thread-post-title').textContent  = postTitle;
  document.getElementById('thread-other-user').textContent  = `Conversation with ${otherName}`;

  // Mark all unread received messages as read now that the user is viewing the thread.
  // We fire these off without awaiting so the UI doesn't stall.
  messages
    .filter((m) => m.receiver_id === myId && m.read === 0)
    .forEach((m) => markRead(m.id).catch(() => {}));

  // Render the initial message list and scroll to the bottom.
  renderMessages(messages, myId);

  // ── Reply form ──
  const replyForm    = document.getElementById('reply-form');
  const replyContent = document.getElementById('reply-content');
  const replyError   = document.getElementById('reply-error');
  const submitBtn    = replyForm.querySelector('button[type="submit"]');

  replyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = replyContent.value.trim();
    replyError.hidden = true;

    if (!content) {
      replyError.textContent = 'Please write a message before sending.';
      replyError.hidden = false;
      return;
    }

    submitBtn.disabled    = true;
    submitBtn.textContent = 'Sending…';

    try {
      const newMessage = await sendMessage(postId, content, otherUserId);
      appendMessage(newMessage, myId);
      replyContent.value = '';
      scrollToBottom();
    } catch (err) {
      replyError.textContent = err.message;
      replyError.hidden = false;
    } finally {
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Send';
    }
  });

});

// ── Render helpers ──

function renderMessages(messages, myId) {
  const container = document.getElementById('thread-messages');
  document.getElementById('thread-loading')?.remove();

  if (!messages || messages.length === 0) {
    container.innerHTML = '<p class="thread-status">No messages yet. Send the first one below.</p>';
    return;
  }

  container.innerHTML = messages.map((m) => messageHtml(m, myId)).join('');
  scrollToBottom();
}

function appendMessage(message, myId) {
  const container = document.getElementById('thread-messages');
  // Remove the empty state text if it's there.
  container.querySelector('.thread-status')?.remove();
  container.insertAdjacentHTML('beforeend', messageHtml(message, myId));
}

// Builds a single message bubble. Sent messages align right; received align left.
function messageHtml(m, myId) {
  const isMine = m.sender_id === myId;
  return `
    <div class="thread-message ${isMine ? 'thread-message--mine' : 'thread-message--theirs'}">
      <div class="thread-bubble">${escHtml(m.content)}</div>
      <time class="thread-time">${escHtml(formatTime(m.created_at))}</time>
    </div>
  `;
}

function scrollToBottom() {
  const container = document.getElementById('thread-messages');
  container.scrollTop = container.scrollHeight;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });
}
