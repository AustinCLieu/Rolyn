import { getSession, signOut } from './auth.js';

const nav = document.getElementById('header-actions');

async function renderHeader() {
  const { data } = await getSession();
  const user = data?.session?.user ?? null;

  if (user) {
    // Logged in — show initial avatar, profile link, sign out
    const email = user.email ?? '';
    const initial = email.charAt(0).toUpperCase();

    nav.innerHTML = `
        <a href="profile.html" class="btn btn-ghost header-profile-btn">Profile</a>
        <button type="button" id="signout-btn" class="btn btn-ghost">Sign out</button>
        <a href="create.html" class="btn btn-primary">Post</a>
    `;

    document.getElementById('signout-btn').addEventListener('click', async () => {
      await signOut();
      window.location.href = 'index.html';
    });

  } else {
    // Logged out — show login/signup
    nav.innerHTML = `
      <a href="login.html" class="btn btn-ghost">Login</a>
      <a href="signup.html" class="btn btn-ghost">Sign Up</a>
      <a href="create.html" class="btn btn-primary">Post</a>
    `;
  }
}

renderHeader();