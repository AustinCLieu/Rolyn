import { sendPasswordResetEmail, updatePassword } from './auth.js';
 
// ── Banned characters (matches signup.js) ──
const BANNED_CHARS = /[<>"'`\\\/;=&|% ]/g;
const BANNED_CHARS_TEST = /[<>"'`\\\/;=&|% ]/;
 
// ── Step elements ──
const stepRequest = document.getElementById('step-request');
const stepSent    = document.getElementById('step-sent');
const stepReset   = document.getElementById('step-reset');
const stepDone    = document.getElementById('step-done');
 
function showStep(step) {
  [stepRequest, stepSent, stepReset, stepDone].forEach((s) => {
    s.hidden = s !== step;
  });
}
 
// ── Check URL for reset token (e.g. ?token=abc123) ──
// When the user clicks the link in their email, they land here with a token.
// Swap this logic out for however your auth.js handles reset tokens.
const urlParams = new URLSearchParams(window.location.search);
const resetToken = urlParams.get('token');
if (resetToken) {
  showStep(stepReset);
}
 
// ── Helpers ──
function showError(el, msg) {
  el.textContent = msg;
  el.hidden = !msg;
}
 
// ── Password scoring (matches signup.js) ──
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
 
const LEVELS = [
  null,
  { label: 'Weak',   cls: 'weak' },
  { label: 'Fair',   cls: 'fair' },
  { label: 'Good',   cls: 'good' },
  { label: 'Strong', cls: 'strong' },
];
 
// ── Step 1: Request reset email ──
const requestForm  = document.getElementById('request-form');
const requestError = document.getElementById('request-error');
const requestBtn   = document.getElementById('request-btn');
 
requestForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError(requestError, '');
 
  const email = requestForm.email.value.trim();
 
  if (!email) {
    showError(requestError, 'Please enter your email address.');
    return;
  }
 
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showError(requestError, 'Please enter a valid email address.');
    return;
  }
 
  requestBtn.disabled = true;
  requestBtn.textContent = 'Sending…';
 
  const { error } = await sendPasswordResetEmail(email);
 
  if (error) {
    showError(requestError, error.message);
    requestBtn.disabled = false;
    requestBtn.textContent = 'Send reset link';
    return;
  }
 
  // Show confirmation step
  document.getElementById('sent-email-display').textContent = email;
  showStep(stepSent);
  startResendCooldown();
});
 
// ── Step 2: Resend button with cooldown ──
const resendBtn       = document.getElementById('resend-btn');
const resendCountdown = document.getElementById('resend-countdown');
let cooldownTimer = null;
 
function startResendCooldown(seconds = 60) {
  resendBtn.disabled = true;
  resendCountdown.hidden = false;
 
  let remaining = seconds;
  resendCountdown.textContent = `(${remaining}s)`;
 
  cooldownTimer = setInterval(() => {
    remaining -= 1;
    resendCountdown.textContent = `(${remaining}s)`;
    if (remaining <= 0) {
      clearInterval(cooldownTimer);
      resendBtn.disabled = false;
      resendCountdown.hidden = true;
    }
  }, 1000);
}
 
resendBtn?.addEventListener('click', async () => {
  const email = document.getElementById('sent-email-display').textContent;
  resendBtn.disabled = true;
 
  const { error } = await sendPasswordResetEmail(email);
  if (!error) {
    startResendCooldown();
  } else {
    resendBtn.disabled = false;
  }
});
 
// ── Step 3: Reset password form ──
const resetForm        = document.getElementById('reset-form');
const resetError       = document.getElementById('reset-error');
const newPasswordEl    = document.getElementById('new-password');
const confirmNewEl     = document.getElementById('confirm-new-password');
const resetMatchIcon   = document.getElementById('reset-match-icon');
const resetStrengthLbl = document.getElementById('reset-strength-label');
const resetSegments    = [
  document.getElementById('rseg1'),
  document.getElementById('rseg2'),
  document.getElementById('rseg3'),
  document.getElementById('rseg4'),
];
 
// Strength bar
newPasswordEl?.addEventListener('input', () => {
  // Strip banned chars
  const raw = newPasswordEl.value;
  if (BANNED_CHARS_TEST.test(raw)) {
    newPasswordEl.value = raw.replace(BANNED_CHARS, '');
  }
 
  const score = scorePassword(newPasswordEl.value);
  const level = LEVELS[score];
 
  resetSegments.forEach((seg, i) => {
    seg.className = 'strength-segment';
    if (score > 0 && i < score) {
      seg.classList.add(`active-${level.cls}`);
    }
  });
 
  resetStrengthLbl.className = 'strength-label' + (level ? ` ${level.cls}` : '');
  resetStrengthLbl.textContent = level ? level.label : '';
 
  updateResetMatchIcon();
});
 
// Confirm match icon
function updateResetMatchIcon() {
  const pw  = newPasswordEl.value;
  const cpw = confirmNewEl.value;
  if (!cpw) {
    resetMatchIcon.textContent = '';
    resetMatchIcon.classList.remove('visible');
    return;
  }
  const match = pw === cpw;
  resetMatchIcon.textContent = match ? '✓' : '✗';
  resetMatchIcon.style.color = match ? '#12b76a' : '#f04438';
  resetMatchIcon.classList.add('visible');
}
 
confirmNewEl?.addEventListener('input', updateResetMatchIcon);
 
// Submit new password
resetForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError(resetError, '');
 
  const password = newPasswordEl.value;
  const confirm  = confirmNewEl.value;
 
  if (!password || !confirm) {
    showError(resetError, 'Please fill in both password fields.');
    return;
  }
 
  if (BANNED_CHARS_TEST.test(password)) {
    showError(resetError, 'Password contains characters that are not allowed: < > " \' ` \\ / ; = & | %');
    newPasswordEl.focus();
    return;
  }
 
  if (scorePassword(password) < 2) {
    showError(resetError, 'Please choose a stronger password.');
    newPasswordEl.focus();
    return;
  }
 
  if (password !== confirm) {
    showError(resetError, 'Passwords do not match.');
    confirmNewEl.focus();
    return;
  }
 
  // Pass the token from the URL to your auth handler
  const { error } = await updatePassword(password, resetToken);
 
  if (error) {
    showError(resetError, error.message);
    return;
  }
 
  showStep(stepDone);
});