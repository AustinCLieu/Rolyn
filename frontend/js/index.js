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

  function getFilters() {
    const category = [...document.querySelectorAll('input[name="category"]:checked')]
      .map((el) => el.value)[0] ?? '';
    const region = document.getElementById('locations')?.value ?? '';
    const term   = document.getElementById('times')?.value ?? '';
    return { category, region, term };
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

  await loadFirstPage();

  document.querySelectorAll('input[name="category"]').forEach((el) =>
    el.addEventListener('change', loadFirstPage),
  );
  document.getElementById('locations')?.addEventListener('change', loadFirstPage);
  document.getElementById('times')?.addEventListener('change', loadFirstPage);

  document.querySelector('.sidebar-clear')?.addEventListener('click', () => {
    document.querySelectorAll('.sidebar input[type=checkbox]').forEach((el) => {
      el.checked = false;
    });
    document.getElementById('locations').value = '';
    document.getElementById('times').value     = '';
    loadFirstPage();
  });

});
