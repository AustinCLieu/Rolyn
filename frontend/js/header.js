import { getSession, signOut, syncUser } from './auth.js';

const nav = document.getElementById('header-actions');

async function renderHeader() {
  const { data } = await getSession();
  const user = data?.session?.user ?? null;

  if (user) {
    nav.innerHTML = `
      <a href="profile.html" class="btn btn-ghost header-profile-btn">Profile</a>
      <button type="button" id="signout-btn" class="btn btn-ghost">Sign out</button>
      <a href="create.html" class="btn btn-primary">Post</a>
    `;

    document.getElementById('signout-btn').addEventListener('click', async () => {
      await signOut();
      window.location.href = 'index.html';
    });

    // Sync runs on every page load so the SQLite users row stays up to date.
    // This is especially important after a Google OAuth redirect, where the user
    // lands on a page without explicitly going through a "login" button.
    // syncUser is an upsert, so calling it repeatedly is harmless.
    syncUser();

  } else {
    nav.innerHTML = `
      <a href="login.html" class="btn btn-ghost">Login</a>
      <a href="signup.html" class="btn btn-ghost">Sign Up</a>
      <a href="create.html" class="btn btn-primary">Post</a>
    `;
  }
}

renderHeader();

// Wire up the header search bar on every page.
// On index.html, index.js already handles the form in-place (filtering posts without
// navigating away), so we return early and let it take over.
// On every other page, we navigate to index.html with the query in the URL so the
// home page can pick it up and run the search there.
const searchForm = document.querySelector('.header-search');
if (searchForm) {
  searchForm.addEventListener('submit', (e) => {
    if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') return;
    e.preventDefault();
    const q = searchForm.querySelector('input[name="q"]')?.value.trim() ?? '';
    window.location.href = `index.html?q=${encodeURIComponent(q)}`;
  });
}
