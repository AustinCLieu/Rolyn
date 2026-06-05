import { createPost } from './posts.js';
import { getSession }  from './auth.js';
import { api }         from './api.js';

document.addEventListener('DOMContentLoaded', async () => {

  const postBtn   = document.querySelector('.btn-post');
  const errorEl   = document.getElementById('create-error');
  const successEl = document.getElementById('create-success');

  // Require login before showing the form.
  // The backend also enforces this (POST /api/posts requires a valid JWT), but redirecting
  // here gives a better UX than letting the user fill in the form and then getting a 401.
  const { data } = await getSession();
  const user = data?.session?.user ?? null;
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  // Fetch the SQLite profile to get the up-to-date display name.
  // user.user_metadata.display_name is written at signup and never updated when
  // the user changes their name on the profile page — the profile page writes to
  // SQLite instead. Fetching /me here ensures new posts always use the current name.
  let profile = null;
  try {
    const result = await api.get('/api/auth/me');
    profile = result.profile;
  } catch (_) {
    // If the backend is unreachable, fall back to the JWT metadata below.
  }

  function showError(msg) {
    errorEl.textContent  = msg;
    errorEl.hidden       = !msg;
    successEl.hidden     = true;
  }

  function showSuccess(msg) {
    successEl.textContent = msg;
    successEl.hidden      = false;
    errorEl.hidden        = true;
  }

  postBtn?.addEventListener('click', async () => {
    showError('');

    const title       = document.getElementById('title').value.trim();
    const category    = document.getElementById('category').value;
    const description = document.getElementById('description').value.trim();
    const region      = document.getElementById('region').value;
    const term        = document.getElementById('term').value;
    const priceMin    = document.getElementById('price-min').value;
    const priceMax    = document.getElementById('price-max').value;

    if (!title)       { showError('Please enter a job title.');  return; }
    if (!category)    { showError('Please select a job type.');   return; }
    if (!description) { showError('Please enter a description.'); return; }
    if (!region)      { showError('Please select a location.');   return; }
    if (!term)        { showError('Please select a job term.');    return; }

    // author_name is the display name stored in Supabase user_metadata.
    // The backend ignores any user_id sent in the body and uses req.user.id from the JWT instead.
    const authorName = profile?.full_name
      ?? user.user_metadata?.display_name
      ?? user.email.split('@')[0];

    postBtn.disabled    = true;
    postBtn.textContent = 'Posting…';

    try {
      const post = await createPost({
        author_name: authorName,
        title,
        category,
        description,
        region,
        term,
        price_min: priceMin || null,
        price_max: priceMax || null,
      });

      showSuccess('Your listing has been posted!');
      postBtn.textContent = 'Post';

      setTimeout(() => {
        window.location.href = `listing.html?id=${post.id}`;
      }, 1000);

    } catch (err) {
      showError(err.message);
      postBtn.disabled    = false;
      postBtn.textContent = 'Post';
    }
  });

});
