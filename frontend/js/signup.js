import { signUp, signInWithGoogle } from './auth.js';
 
document.addEventListener("DOMContentLoaded", () => {
    /* ── DOM refs ── */
    const form = document.getElementById("signup-form");
    const errorEl = document.getElementById("auth-error");
    const successEl = document.getElementById("auth-success");
    const passwordEl = document.getElementById("password");
    const confirmEl = document.getElementById("confirm-password");
    const matchIcon = document.getElementById("match-icon");
    const strengthLbl = document.getElementById("strength-label");
    const segments = [
        document.getElementById("seg1"),
        document.getElementById("seg2"),
        document.getElementById("seg3"),
        document.getElementById("seg4"),
    ];

    /* ── Helpers ── */
    function showError(msg) {
        errorEl.textContent = msg;
        errorEl.hidden = !msg;
        successEl.hidden = true;
    }

    function showSuccess(msg) {
        successEl.textContent = msg;
        successEl.hidden = !msg;
        errorEl.hidden = true;
    }

    const BANNED_CHARS = /[<>"'`\\\/;=&|% ]/g;
    const BANNED_CHARS_TEST = /[<>"'`\\\/;=&|% ]/;

    /* ── Password strength ── */
    function scorePassword(pw) {
    if (!pw) return 0;

    let score = 0;

    // Length bonuses — longer passwords get more points
    if (pw.length >= 6)  score += 1;
    if (pw.length >= 10) score += 1;
    if (pw.length >= 16) score += 1;

    // Character variety bonuses
    if (/[A-Z]/.test(pw)) score += 1;          // has uppercase
    if (/[a-z]/.test(pw)) score += 1;          // has lowercase
    if (/[0-9]/.test(pw)) score += 1;          // has number
    if (/[^A-Za-z0-9]/.test(pw)) score += 2;  // has symbol (worth extra)

    // Map raw score (0–9) onto 4 segments:
    // 0     → 0 (empty)
    // 1–2   → 1 (Weak)
    // 3–4   → 2 (Fair)
    // 5–6   → 3 (Good)
    // 7–9   → 4 (Strong)
    if (score === 0) return 0;
    if (score <= 2)  return 1;
    if (score <= 4)  return 2;
    if (score <= 6)  return 3;
    return 4;
    }

    const LEVELS = [
        null,
        { label: "Weak",   cls: "weak" },
        { label: "Fair",   cls: "fair" },
        { label: "Good",   cls: "good" },
        { label: "Strong", cls: "strong" },
    ];

    passwordEl.addEventListener("input", () => {
        // Strip banned characters as the user types
        const raw = passwordEl.value;
        if (BANNED_CHARS_TEST.test(raw)) {
            passwordEl.value = raw.replace(BANNED_CHARS, "");
            // Show a one-time warning beneath the field
            let warn = document.getElementById("banned-char-warning");
            if (!warn) {
            warn = document.createElement("p");
            warn.id = "banned-char-warning";
            warn.className = "form-hint";
            warn.style.color = "#f79009";
            warn.textContent = 'Some characters are not allowed: < > " \' ` \\ / ; = & | %';
            passwordEl.parentElement.insertBefore(warn, document.querySelector(".strength-bar-track"));
            }
            // Auto-hide after 3 seconds
            clearTimeout(warn._hideTimer);
            warn._hideTimer = setTimeout(() => warn.remove(), 3000);
        }

        const score = scorePassword(passwordEl.value);
        const level = LEVELS[score];

        segments.forEach((seg, i) => {
            seg.className = "strength-segment";
            if (score > 0 && i < score) {
            seg.classList.add(`active-${level.cls}`);
        }
    });

    strengthLbl.className = "strength-label" + (level ? ` ${level.cls}` : "");
    strengthLbl.textContent = level ? level.label : "";

    updateMatchIcon();
    });

    /* ── Confirm match icon ── */
    function updateMatchIcon() {
        const pw  = passwordEl.value;
        const cpw = confirmEl.value;

        if (!cpw) {
            matchIcon.textContent = "";
            matchIcon.classList.remove("visible");
            return;
        }

        const match = pw === cpw;
        matchIcon.textContent = match ? "✓" : "✗";
        matchIcon.style.color = match ? "#12b76a" : "#f04438";
        matchIcon.classList.add("visible");
    }

    confirmEl.addEventListener("input", updateMatchIcon);

    /* ── Form submit ── */
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        showError("");

        const email    = form.email.value.trim();
        const fullName = form['full-name'].value.trim();
        const location = form.location.value;
        const phone    = form.phone.value.trim();
        const password = passwordEl.value;
        const confirm  = confirmEl.value;

        // Check all fields are filled
        if (!email || !fullName || !location || !password || !confirm) {
            showError("Please fill in all required fields.");
            return;
        }

            if (fullName.length < 2) {
            showError("Please enter your full name.");
            form['full-name'].focus();
            return;
        }

        if (BANNED_CHARS_TEST.test(password)) {
            showError('Password contains characters that are not allowed: < > " \' ` \\ / ; = & | %');
            passwordEl.focus();
            return;
        }

        // Check email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showError("Please enter a valid email address.");
            form.email.focus();
            return;
        }

        // Check passwords match
        if (password !== confirm) {
            showError("Passwords do not match.");
            confirmEl.focus();
            return;
        }

        if (scorePassword(password) < 2) {
            showError("Please choose a stronger password.");
            passwordEl.focus();
            return;
        }

        const { error } = await signUp(email, password, {
            display_name: fullName,
            location,
            phone,
        });
        if (error) {
            showError(error.message);
            return;
        }

        showSuccess("Account created! Check your email to confirm, then log in.");
        form.reset();
        segments.forEach(s => s.className = "strength-segment");
        strengthLbl.textContent = "";
        matchIcon.classList.remove("visible");
    });

    /* ── Google ── */
    document.getElementById("google-signup")?.addEventListener("click", () => {
        signInWithGoogle();
    });
});