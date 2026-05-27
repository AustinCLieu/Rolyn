import { getSession, updateUserEmail, updateUserPassword, deleteAccount, getUserListings } from './auth.js';
 
// ── Banned characters (matches signup.js) ──
const BANNED_CHARS     = /[<>"'`\\\/;=&|% ]/g;
const BANNED_CHARS_TEST = /[<>"'`\\\/;=&|% ]/;
 
document.addEventListener('DOMContentLoaded', async () => {
 
  // ── Auth guard: redirect if not logged in ──
  const { data } = await getSession();
  const user = data?.session?.user ?? null;
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
 
  // ── Populate identity card ──
  const email   = user.email ?? '';
  const name    = user.user_metadata?.display_name ?? email.split('@')[0];
  const initial = name.charAt(0).toUpperCase();
 
  const createdAt = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long' })
    : '';
 
  document.getElementById('profile-avatar').textContent       = initial;
  document.getElementById('profile-name').textContent         = name;
  document.getElementById('profile-email').textContent        = email;
  document.getElementById('profile-member-since').textContent = createdAt ? `Member since ${createdAt}` : '';
  document.getElementById('display-name').value               = name;
  document.getElementById('new-email').value                  = email;
 
  // ── Tab switching ──
  const tabs    = document.querySelectorAll('.profile-tab');
  const navBtns = document.querySelectorAll('.profile-nav-btn');
 
  navBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
 
      navBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
 
      tabs.forEach((tab) => {
        tab.hidden = tab.id !== `tab-${target}`;
      });
    });
  });
 
  // ── Load listings ──
  await loadListings(user.id);
 
  // ── Save display name ──
  const saveNameBtn    = document.getElementById('save-name-btn');
  const nameError      = document.getElementById('settings-error-name');
  const nameSuccess    = document.getElementById('settings-success-name');
 
  saveNameBtn?.addEventListener('click', async () => {
    const newName = document.getElementById('display-name').value.trim();
    clearMsg(nameError, nameSuccess);
 
    if (!newName) {
      showError(nameError, 'Please enter a display name.');
      return;
    }
 
    // Update metadata via your auth.js updateUserName function
    // Replace with your actual auth call:
    // const { error } = await updateUserName(newName);
    // if (error) { showError(nameError, error.message); return; }
 
    document.getElementById('profile-name').textContent = newName;
    document.getElementById('profile-avatar').textContent = newName.charAt(0).toUpperCase();
    showSuccess(nameSuccess, 'Display name updated.');
  });
 
  // ── Save email ──
  const saveEmailBtn  = document.getElementById('save-email-btn');
  const emailError    = document.getElementById('settings-error-email');
  const emailSuccess  = document.getElementById('settings-success-email');
 
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
  const newPwEl    = document.getElementById('new-password');
  const confirmPwEl = document.getElementById('confirm-new-password');
  const matchIcon  = document.getElementById('pw-match-icon');
  const strengthLbl = document.getElementById('pw-strength-label');
  const segments   = [
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
    if (BANNED_CHARS_TEST.test(raw)) {
      newPwEl.value = raw.replace(BANNED_CHARS, '');
    }
 
    const score = scorePassword(newPwEl.value);
    const level = LEVELS[score];
 
    segments.forEach((seg, i) => {
      seg.className = 'strength-segment';
      if (score > 0 && i < score) seg.classList.add(`active-${level.cls}`);
    });
 
    strengthLbl.className = 'strength-label' + (level ? ` ${level.cls}` : '');
    strengthLbl.textContent = level ? level.label : '';
 
    updateMatchIcon();
  });
 
  function updateMatchIcon() {
    const pw  = newPwEl.value;
    const cpw = confirmPwEl.value;
    if (!cpw) {
      matchIcon.textContent = '';
      matchIcon.classList.remove('visible');
      return;
    }
    const match = pw === cpw;
    matchIcon.textContent   = match ? '✓' : '✗';
    matchIcon.style.color   = match ? '#12b76a' : '#f04438';
    matchIcon.classList.add('visible');
  }
 
  confirmPwEl?.addEventListener('input', updateMatchIcon);
 
  // ── Save password ──
  const savePwBtn   = document.getElementById('save-pw-btn');
  const pwError     = document.getElementById('settings-error-pw');
  const pwSuccess   = document.getElementById('settings-success-pw');
 
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
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This cannot be undone.'
    );
    if (!confirmed) return;
 
    const { error } = await deleteAccount();
    if (error) {
      alert('Could not delete account: ' + error.message);
      return;
    }
 
    window.location.href = 'index.html';
  });
 
});
 
// ── Listings loader ──
async function loadListings(userId) {
  const listingsEl = document.getElementById('listings-list');
  const emptyEl    = document.getElementById('listings-empty');
 
  // Replace with your actual data fetch, e.g. getUserListings(userId)
  // const { data: listings, error } = await getUserListings(userId);
  // Stubbing with empty array until wired up:
  const listings = [];
 
  if (!listings || listings.length === 0) {
    emptyEl.hidden = false;
    return;
  }
 
  emptyEl.hidden = true;
  listingsEl.innerHTML = listings.map((l) => `
    <div class="profile-listing-card">
      <p class="profile-listing-meta">${escHtml(l.category)} · ${escHtml(l.term)} · ${escHtml(l.location)}</p>
      <h3 class="profile-listing-title">${escHtml(l.title)}</h3>
      <p class="profile-listing-body">${escHtml(l.description)}</p>
      <div class="profile-listing-footer">
        <p class="profile-listing-pay"><strong>Pay:</strong> ${escHtml(l.pay)}</p>
        <div class="profile-listing-actions">
          <span class="profile-listing-badge ${l.active ? 'profile-listing-badge--active' : 'profile-listing-badge--closed'}">
            ${l.active ? 'Active' : 'Closed'}
          </span>
          <a href="listing.html?id=${l.id}" class="btn btn-ghost">View</a>
          <button type="button" class="btn btn-ghost" data-delete-id="${l.id}">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
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
 
function showError(el, msg) {
  el.textContent = msg;
  el.hidden = false;
}
 
function showSuccess(el, msg) {
  el.textContent = msg;
  el.hidden = false;
}
 
function clearMsg(...els) {
  els.forEach((el) => { el.textContent = ''; el.hidden = true; });
}
 
function escHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}