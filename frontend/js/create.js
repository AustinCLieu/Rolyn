// js/create.js
import { createPost } from './posts.js';
import { getSession }  from './auth.js';
 
document.addEventListener('DOMContentLoaded', async () => {
 
  const postBtn  = document.querySelector('.btn-post');
  const errorEl  = document.getElementById('create-error');
  const successEl = document.getElementById('create-success');
 
  // Get logged-in user if available (optional — posts allowed anonymously too)
  let user = null;
  try {
    const { data } = await getSession();
    user = data?.session?.user ?? null;
  } catch (_) { /* not logged in, that's ok */ }
 
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
 
    // Client-side validation
    if (!title)       { showError('Please enter a job title.');        return; }
    if (!category)    { showError('Please select a job type.');         return; }
    if (!description) { showError('Please enter a description.');       return; }
    if (!region)      { showError('Please select a location.');         return; }
    if (!term)        { showError('Please select a job term.');          return; }
 
    const authorName = user?.user_metadata?.display_name
      ?? user?.email?.split('@')[0]
      ?? 'Anonymous';
 
    postBtn.disabled      = true;
    postBtn.textContent   = 'Posting…';
 
    try {
      const post = await createPost({
        user_id:     user?.id ?? null,
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
 
      // Redirect to the new listing after a short delay
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