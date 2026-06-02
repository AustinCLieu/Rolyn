// js/index.js
import {
  fetchPosts,
  CATEGORY_LABELS,
  REGION_LABELS,
  TERM_LABELS,
  formatPay,
  timeAgo,
  escHtml,
} from './posts.js';
 
document.addEventListener('DOMContentLoaded', async () => {
 
  const feed    = document.getElementById('posts-feed');
  const empty   = document.getElementById('posts-empty');
  const loading = document.getElementById('posts-loading');
 
  async function loadPosts() {
    const category = [...document.querySelectorAll('input[name="category"]:checked')]
      .map((el) => el.value)[0] ?? '';
    const region = document.getElementById('locations')?.value ?? '';
    const term   = document.getElementById('times')?.value ?? '';
 
    loading.hidden = false;
    feed.innerHTML = '';
    empty.hidden   = true;
 
    try {
      const posts = await fetchPosts({ category, region, term });
 
      loading.hidden = true;
 
      if (posts.length === 0) {
        empty.hidden = false;
        return;
      }
 
      feed.innerHTML = posts.map((p) => `
        <article class="sidebar-card post-card">
          <p class="filter-label">
            ${escHtml(CATEGORY_LABELS[p.category] ?? p.category)}
            · ${escHtml(TERM_LABELS[p.term] ?? p.term)}
            · ${escHtml(REGION_LABELS[p.region] ?? p.region)}
          </p>
          <h3 class="post-card-title">
            <a href="listing.html?id=${p.id}">${escHtml(p.title)}</a>
          </h3>
          <p class="post-card-body">${escHtml(p.description.slice(0, 140))}${p.description.length > 140 ? '…' : ''}</p>
          <div class="post-card-footer">
            <span class="post-card-pay"><strong>Pay:</strong> ${formatPay(p.price_min, p.price_max)}</span>
            <span class="post-card-time">${timeAgo(p.created_at)}</span>
          </div>
          <a href="listing.html?id=${p.id}" class="btn btn-ghost post-card-btn">More details</a>
        </article>
      `).join('');
 
    } catch (err) {
      loading.hidden = true;
      feed.innerHTML = `<p class="post-load-error">Could not load listings: ${escHtml(err.message)}</p>`;
    }
  }
 
  // Initial load
  await loadPosts();
 
  // Re-load on filter changes
  document.querySelectorAll('input[name="category"]').forEach((el) =>
    el.addEventListener('change', loadPosts)
  );
  document.getElementById('locations')?.addEventListener('change', loadPosts);
  document.getElementById('times')?.addEventListener('change', loadPosts);
 
  // Clear filters
  document.querySelector('.sidebar-clear')?.addEventListener('click', () => {
    document.querySelectorAll('.sidebar input[type=checkbox]').forEach((el) => {
      el.checked = false;
    });
    document.getElementById('locations').value = '';
    document.getElementById('times').value     = '';
    loadPosts();
  });
 
});