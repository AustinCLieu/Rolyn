// js/index.js
import {
  fetchPosts,
  CATEGORY_LABELS,
  REGION_LABELS,
  TERM_LABELS,
  formatPay,
  formatPostedAt,
  parsePostDate,
  escHtml,
} from './posts.js';
import { BACKEND_URL } from './config.js';

// How many listings each request loads (initial page + each "Load more" click)
const POSTS_PER_PAGE = 5;

document.addEventListener('DOMContentLoaded', async () => {

  const feed       = document.getElementById('posts-feed');
  const empty      = document.getElementById('posts-empty');
  const loading    = document.getElementById('posts-loading');
  const loadMoreBtn = document.getElementById('posts-load-more');

  let offset = 0;
  let hasMore = false;
  let loadingMore = false;

  const searchForm  = document.getElementById('header-search-form');
  const searchInput = document.getElementById('search-input');
  const emptyDefaultHtml = empty?.innerHTML ?? '';

  function getFilters() {
    const category = document.getElementById('category')?.value ?? '';
    const region   = document.getElementById('locations')?.value ?? '';
    const term     = document.getElementById('times')?.value ?? '';
    const q        = searchInput?.value.trim() ?? '';
    return { category, region, term, q };
  }

  function updateEmptyMessage() {
    const q = searchInput?.value.trim();
    if (!empty) return;
    if (q) {
      empty.innerHTML = `No listings matching &ldquo;${escHtml(q)}&rdquo;. <a href="create.html">Post one!</a>`;
    } else {
      empty.innerHTML = emptyDefaultHtml;
    }
  }

  function postCardHtml(p) {
    const postedAt = formatPostedAt(p.created_at);
    const iso = parsePostDate(p.created_at).toISOString();
    return `
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
          <time class="post-card-time" datetime="${escHtml(iso)}">Posted ${escHtml(postedAt)}</time>
        </div>
        <a href="listing.html?id=${p.id}" class="btn btn-ghost post-card-btn">More details</a>
      </article>
    `;
  }

  function updateLoadMoreButton() {
    if (!loadMoreBtn) return;
    loadMoreBtn.hidden = !hasMore;
    loadMoreBtn.disabled = loadingMore;
    loadMoreBtn.textContent = 'Load more';
  }

  async function loadFirstPage() {
    const filters = getFilters();

    loading.hidden = false;
    loadMoreBtn.hidden = true;
    feed.innerHTML = '';
    empty.hidden   = true;
    offset = 0;
    hasMore = false;

    try {
      const { posts, hasMore: more } = await fetchPosts({
        ...filters,
        limit: POSTS_PER_PAGE,
        offset: 0,
      });

      loading.hidden = true;
      offset = posts.length;
      hasMore = more;

      if (posts.length === 0) {
        updateEmptyMessage();
        empty.hidden = false;
        return;
      }

      feed.innerHTML = posts.map(postCardHtml).join('');
      updateLoadMoreButton();
    } catch (err) {
      loading.hidden = true;
      feed.innerHTML = `<p class="post-load-error">Could not load listings: ${escHtml(err.message)}</p>`;
    }
  }

  async function loadNextPage() {
    if (!hasMore || loadingMore) return;

    loadingMore = true;
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Loading…';

    try {
      const { posts, hasMore: more } = await fetchPosts({
        ...getFilters(),
        limit: POSTS_PER_PAGE,
        offset,
      });

      offset += posts.length;
      hasMore = more;

      if (posts.length > 0) {
        feed.insertAdjacentHTML('beforeend', posts.map(postCardHtml).join(''));
      }
    } catch (err) {
      feed.insertAdjacentHTML(
        'beforeend',
        `<p class="post-load-error">Could not load more: ${escHtml(err.message)}</p>`,
      );
      hasMore = false;
    } finally {
      loadingMore = false;
      updateLoadMoreButton();
    }
  }

  loadMoreBtn?.addEventListener('click', loadNextPage);

  searchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    loadFirstPage();
  });

  // Restore ?q= from URL when landing from another page
  const urlQ = new URLSearchParams(location.search).get('q');
  if (urlQ && searchInput) searchInput.value = urlQ;

  // Load real post and city counts for the welcome banner stats.
  // Runs in parallel with the first page of listings so neither waits on the other.
  loadStats();
  await loadFirstPage();

  document.getElementById('category')?.addEventListener('change', loadFirstPage);
  document.getElementById('locations')?.addEventListener('change', loadFirstPage);
  document.getElementById('times')?.addEventListener('change', loadFirstPage);

  document.querySelector('.sidebar-clear')?.addEventListener('click', () => {
    document.getElementById('category').value  = '';
    document.getElementById('locations').value = '';
    document.getElementById('times').value     = '';
    loadFirstPage();
  });

});

async function loadStats() {
  try {
    const { total_posts, total_cities } = await fetch(`${BACKEND_URL}/api/stats`).then(r => r.json());
    const postsEl  = document.getElementById('stat-posts');
    const citiesEl = document.getElementById('stat-cities');
    if (postsEl)  postsEl.textContent  = total_posts;
    if (citiesEl) citiesEl.textContent = total_cities;
  } catch (_) {
    // If the backend is unreachable just leave the — placeholder showing.
  }
}
