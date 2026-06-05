import { getSession, updateProfile, updateUserEmail, updateUserPassword, deleteAccount, getUserListings } from './auth.js';
import { api }         from './api.js';
import { deletePost, closePost } from './posts.js';
import { fetchInbox }  from './messages.js';

const BANNED_CHARS      = /[<>"'`\\\/;=&|% ]/g;
const BANNED_CHARS_TEST = /[<>"'`\\\/;=&|% ]/;

document.addEventListener('DOMContentLoaded', async () => {

  // ── Auth guard ──
  const { data } = await getSession();
  const session  = data?.session ?? null;
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  // ── Load profile from backend (SQLite) ──
  // We call /api/auth/me instead of reading user_metadata directly from the Supabase session.
  // The reason: user_metadata is written at signup time and doesn't update when the user
  // edits their display name/location/phone on this page. SQLite is our source of truth
  // for those fields. /me also auto-creates the SQLite row if it somehow doesn't exist yet.
  let profile = null;
  try {
    const result = await api.get('/api/auth/me');
    profile = result.profile;
  } catch (_) {
    // If the backend is unreachable, fall back to whatever is in the JWT metadata.
  }

  const user     = session.user;
  const meta     = user.user_metadata ?? {};

  // Prefer SQLite data; fall back to JWT metadata for first-time users who haven't synced
  const name     = profile?.full_name   ?? meta.display_name ?? user.email.split('@')[0];
  const location = profile?.location    ?? meta.location     ?? '';
  const phone    = profile?.phone       ?? meta.phone        ?? '';
  const email    = user.email           ?? '';
  const initial  = name.charAt(0).toUpperCase();

  const createdAt = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long' })
    : '';

  // ── Populate identity card ──
  document.getElementById('profile-avatar').textContent       = initial;
  document.getElementById('profile-name').textContent         = name;
  document.getElementById('profile-email').textContent        = email;
  document.getElementById('profile-member-since').textContent = createdAt ? `Member since ${createdAt}` : '';

  // ── Populate settings form fields ──
  document.getElementById('display-name').value = name;
  document.getElementById('new-email').value    = email;

  const profileLocationEl = document.getElementById('profile-location');
  const profilePhoneEl    = document.getElementById('profile-phone');
  if (profileLocationEl) profileLocationEl.value = location;
  if (profilePhoneEl)    profilePhoneEl.value    = phone;

  const locationDisplayEl = document.getElementById('profile-location-display');
  const phoneDisplayEl    = document.getElementById('profile-phone-display');
  if (locationDisplayEl) locationDisplayEl.textContent = location || 'Not set';
  if (phoneDisplayEl)    phoneDisplayEl.textContent    = phone    || 'Not set';

  // ── Tab switching ──
  const tabs    = document.querySelectorAll('.profile-tab');
  const navBtns = document.querySelectorAll('.profile-nav-btn');

  navBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      navBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      tabs.forEach((tab) => { tab.hidden = tab.id !== `tab-${target}`; });
    });
  });

  // ── Load listings and inbox ──
  await loadListings(user.id);
  await loadInbox();

  // ── Save profile (name, location, phone) ──
  // We send all three fields together so the backend can update them in one query.
  // updateProfile hits PATCH /api/auth/profile which writes to SQLite.
  const saveNameBtn  = document.getElementById('save-name-btn');
  const nameError    = document.getElementById('settings-error-name');
  const nameSuccess  = document.getElementById('settings-success-name');

  saveNameBtn?.addEventListener('click', async () => {
    const newName     = document.getElementById('display-name').value.trim();
    const newLocation = profileLocationEl?.value ?? '';
    const newPhone    = profilePhoneEl?.value.trim() ?? '';
    clearMsg(nameError, nameSuccess);

    if (!newName) {
      showError(nameError, 'Please enter a display name.');
      return;
    }

    const { error } = await updateProfile({
      full_name: newName,
      location:  newLocation || null,
      phone:     newPhone    || null,
    });

    if (error) {
      showError(nameError, error.message);
      return;
    }

    // Refresh the identity card so the user sees the change immediately
    document.getElementById('profile-name').textContent   = newName;
    document.getElementById('profile-avatar').textContent = newName.charAt(0).toUpperCase();
    if (locationDisplayEl) locationDisplayEl.textContent  = newLocation || 'Not set';
    if (phoneDisplayEl)    phoneDisplayEl.textContent     = newPhone    || 'Not set';
    showSuccess(nameSuccess, 'Profile updated.');
  });

  // ── Save email ──
  // Email changes go through Supabase Auth, which sends a confirmation link.
  // The change doesn't take effect until the user clicks that link.
  const saveEmailBtn = document.getElementById('save-email-btn');
  const emailError   = document.getElementById('settings-error-email');
  const emailSuccess = document.getElementById('settings-success-email');

  saveEmailBtn?.addEventListener('click', async () => {
    const newEmail = document.getElementById('new-email').value.trim();
    clearMsg(emailError, emailSuccess);

    if (!newEmail) {
      showError(emailError, 'Please enter an email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      showError(emailError, 'Please enter a valid email address.');
      return;
    }

    const { error } = await updateUserEmail(newEmail);
    if (error) { showError(emailError, error.message); return; }
    showSuccess(emailSuccess, 'Check your new email address for a confirmation link.');
  });

  // ── Password strength bar ──
  const newPwEl     = document.getElementById('new-password');
  const confirmPwEl = document.getElementById('confirm-new-password');
  const matchIcon   = document.getElementById('pw-match-icon');
  const strengthLbl = document.getElementById('pw-strength-label');
  const segments    = [
    document.getElementById('pseg1'),
    document.getElementById('pseg2'),
    document.getElementById('pseg3'),
    document.getElementById('pseg4'),
  ];

  const LEVELS = [
    null,
    { label: 'Weak',   cls: 'weak' },
    { label: 'Fair',   cls: 'fair' },
    { label: 'Good',   cls: 'good' },
    { label: 'Strong', cls: 'strong' },
  ];

  newPwEl?.addEventListener('input', () => {
    const raw = newPwEl.value;
    if (BANNED_CHARS_TEST.test(raw)) newPwEl.value = raw.replace(BANNED_CHARS, '');

    const score = scorePassword(newPwEl.value);
    const level = LEVELS[score];
    segments.forEach((seg, i) => {
      seg.className = 'strength-segment';
      if (score > 0 && i < score) seg.classList.add(`active-${level.cls}`);
    });
    strengthLbl.className   = 'strength-label' + (level ? ` ${level.cls}` : '');
    strengthLbl.textContent = level ? level.label : '';
    updateMatchIcon();
  });

  function updateMatchIcon() {
    const pw  = newPwEl.value;
    const cpw = confirmPwEl.value;
    if (!cpw) { matchIcon.textContent = ''; matchIcon.classList.remove('visible'); return; }
    const match = pw === cpw;
    matchIcon.textContent = match ? '✓' : '✗';
    matchIcon.style.color = match ? '#12b76a' : '#f04438';
    matchIcon.classList.add('visible');
  }

  confirmPwEl?.addEventListener('input', updateMatchIcon);

  // ── Save password ──
  const savePwBtn  = document.getElementById('save-pw-btn');
  const pwError    = document.getElementById('settings-error-pw');
  const pwSuccess  = document.getElementById('settings-success-pw');

  savePwBtn?.addEventListener('click', async () => {
    clearMsg(pwError, pwSuccess);
    const currentPw = document.getElementById('current-password').value;
    const newPw     = newPwEl.value;
    const confirmPw = confirmPwEl.value;

    if (!currentPw || !newPw || !confirmPw) {
      showError(pwError, 'Please fill in all password fields.');
      return;
    }
    if (BANNED_CHARS_TEST.test(newPw)) {
      showError(pwError, 'Password contains characters that are not allowed.');
      return;
    }
    if (scorePassword(newPw) < 2) {
      showError(pwError, 'Please choose a stronger password.');
      return;
    }
    if (newPw !== confirmPw) {
      showError(pwError, 'New passwords do not match.');
      return;
    }

    const { error } = await updateUserPassword(newPw);
    if (error) { showError(pwError, error.message); return; }

    showSuccess(pwSuccess, 'Password updated successfully.');
    document.getElementById('current-password').value = '';
    newPwEl.value = '';
    confirmPwEl.value = '';
    segments.forEach((s) => s.className = 'strength-segment');
    strengthLbl.textContent = '';
    matchIcon.classList.remove('visible');
  });

  // ── Delete account ──
  document.getElementById('delete-account-btn')?.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete your account? This cannot be undone.')) return;

    const { error } = await deleteAccount();
    if (error) {
      alert('Could not delete account: ' + error.message);
      return;
    }
    window.location.href = 'index.html';
  });

});

// ── Listings loader ──
// Calls GET /api/posts?user_id=<id> via getUserListings, then renders the cards.
// Event delegation on the list handles delete clicks so we don't bind a listener
// to every card individually.
async function loadListings(userId) {
  const listingsEl = document.getElementById('listings-list');
  const emptyEl    = document.getElementById('listings-empty');

  const { data: listings, error } = await getUserListings(userId);

  if (error) {
    emptyEl.textContent = 'Could not load your listings.';
    emptyEl.hidden = false;
    return;
  }

  if (!listings || listings.length === 0) {
    emptyEl.hidden = false;
    return;
  }

  emptyEl.hidden = true;
  listingsEl.innerHTML = listings.map((l) => `
    <div class="profile-listing-card" data-listing-id="${l.id}">
      <p class="profile-listing-meta">${escHtml(l.category)} · ${escHtml(l.term)} · ${escHtml(l.region)}</p>
      <h3 class="profile-listing-title">${escHtml(l.title)}</h3>
      <p class="profile-listing-body">${escHtml(l.description)}</p>
      <div class="profile-listing-footer">
        <div class="profile-listing-actions">
          <span class="profile-listing-badge ${l.active ? 'profile-listing-badge--active' : 'profile-listing-badge--closed'}" id="badge-${l.id}">${l.active ? 'Active' : 'Closed'}</span>
          <a href="listing.html?id=${l.id}" class="btn btn-ghost">View</a>
          <button type="button" class="btn btn-ghost" data-close-id="${l.id}" ${l.active ? '' : 'disabled'}>Close</button>
          <button type="button" class="btn btn-ghost" data-delete-id="${l.id}">Delete</button>
        </div>
      </div>
    </div>
  `).join('');

  // Single delegated listener handles both Close and Delete clicks.
  // We check for close first, then delete, so each branch is self-contained.
  listingsEl.addEventListener('click', async (e) => {

    // ── Close ──
    const closeBtn = e.target.closest('[data-close-id]');
    if (closeBtn) {
      if (!confirm('Mark this listing as closed? It will no longer appear in search results.')) return;

      const id = closeBtn.dataset.closeId;
      try {
        await closePost(id);
        // Swap the badge from Active → Closed so the user sees the change immediately.
        const badge = document.getElementById(`badge-${id}`);
        if (badge) {
          badge.textContent = 'Closed';
          badge.classList.replace('profile-listing-badge--active', 'profile-listing-badge--closed');
        }
        // Disable the Close button so it can't be clicked again on the same card.
        closeBtn.disabled = true;
        closeBtn.textContent = 'Closed';
      } catch (err) {
        alert('Could not close listing: ' + err.message);
      }
      return;
    }

    // ── Delete ──
    const deleteBtn = e.target.closest('[data-delete-id]');
    if (!deleteBtn) return;

    if (!confirm('Are you sure you want to delete this listing?')) return;

    const id = deleteBtn.dataset.deleteId;
    try {
      await deletePost(id);
      const card = listingsEl.querySelector(`[data-listing-id="${id}"]`);
      card?.remove();
      if (!listingsEl.querySelector('.profile-listing-card')) {
        emptyEl.hidden = false;
      }
    } catch (err) {
      alert('Could not delete listing: ' + err.message);
    }
  });
}

// ── Inbox loader ──
// Fetches all conversation threads for the logged-in user and renders them as
// clickable cards. Also updates the unread badge on the Messages tab button.
async function loadInbox() {
  const loadingEl  = document.getElementById('messages-loading');
  const emptyEl    = document.getElementById('messages-empty');
  const listEl     = document.getElementById('messages-list');
  const badgeEl    = document.getElementById('messages-badge');

  try {
    const threads = await fetchInbox();

    loadingEl.hidden = true;

    if (!threads || threads.length === 0) {
      emptyEl.hidden = false;
      return;
    }

    // Total unread across all threads drives the tab badge.
    const totalUnread = threads.reduce((sum, t) => sum + (t.unread_count ?? 0), 0);
    if (totalUnread > 0) {
      badgeEl.textContent = totalUnread;
      badgeEl.hidden = false;
    }

    listEl.innerHTML = threads.map((t) => {
      const preview  = (t.last_content ?? '').slice(0, 80);
      const ellipsis = (t.last_content ?? '').length > 80 ? '…' : '';
      const timeStr  = formatMessageTime(t.last_message_at);
      const unread   = t.unread_count > 0;

      return `
        <a href="messages.html?post=${t.post_id}&user=${encodeURIComponent(t.other_user_id)}"
           class="profile-message-card${unread ? ' profile-message-card--unread' : ''}">
          <div class="profile-message-info">
            <p class="profile-message-post">${escHtml(t.post_title)}</p>
            <p class="profile-message-from">${escHtml(t.other_user_name)}</p>
            <p class="profile-message-preview">${escHtml(preview)}${ellipsis}</p>
          </div>
          <div class="profile-message-meta">
            <time>${escHtml(timeStr)}</time>
            ${unread ? `<span class="profile-message-badge">${t.unread_count}</span>` : ''}
          </div>
        </a>
      `;
    }).join('');

  } catch (err) {
    loadingEl.hidden = true;
    emptyEl.textContent = 'Could not load messages.';
    emptyEl.hidden = false;
  }
}

function formatMessageTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });
}

// ── Helpers ──
function scorePassword(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 6)  score += 1;
  if (pw.length >= 10) score += 1;
  if (pw.length >= 16) score += 1;
  if (/[A-Z]/.test(pw)) score += 1;
  if (/[a-z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 2;
  if (score === 0) return 0;
  if (score <= 2)  return 1;
  if (score <= 4)  return 2;
  if (score <= 6)  return 3;
  return 4;
}

function showError(el, msg)   { el.textContent = msg; el.hidden = false; }
function showSuccess(el, msg) { el.textContent = msg; el.hidden = false; }
function clearMsg(...els)     { els.forEach((el) => { el.textContent = ''; el.hidden = true; }); }

function escHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
