// js/listing.js
import {
  fetchPost,
  CATEGORY_LABELS,
  REGION_LABELS,
  TERM_LABELS,
  formatPay,
  timeAgo,
  escHtml,
} from './posts.js';
import { getSession }  from './auth.js';
import { sendMessage } from './messages.js';

document.addEventListener('DOMContentLoaded', async () => {

  const id = new URLSearchParams(window.location.search).get('id');

  if (!id) {
    document.title = 'Not found — Rolyn';
    document.querySelector('.listing')?.replaceWith(notFound());
    return;
  }

  try {
    const p = await fetchPost(id);
    renderListing(p);
  } catch (err) {
    document.querySelector('.listing')?.replaceWith(notFound());
    return;
  }

  // ── Message form ──
  // Check login state to decide whether to show the form or the login prompt.
  // We do this after fetching the post so the page isn't blank while we check auth.
  const { data } = await getSession();
  const user = data?.session?.user ?? null;

  const loginPrompt = document.getElementById('message-login-prompt');
  const messageForm = document.getElementById('message-form');

  if (!user) {
    // Not logged in — show the login prompt, keep the form hidden.
    loginPrompt.hidden = false;
  } else {
    // Logged in — show the form, keep the login prompt hidden.
    messageForm.hidden = false;

    const errorEl   = document.getElementById('message-error');
    const successEl = document.getElementById('message-success');
    const submitBtn = messageForm.querySelector('button[type="submit"]');

    messageForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const content = document.getElementById('message-content').value.trim();

      errorEl.hidden   = true;
      successEl.hidden = true;

      if (!content) {
        errorEl.textContent = 'Please write a message before sending.';
        errorEl.hidden = false;
        return;
      }

      submitBtn.disabled    = true;
      submitBtn.textContent = 'Sending…';

      try {
        await sendMessage(id, content);
        successEl.textContent = 'Your message has been sent!';
        successEl.hidden = false;
        messageForm.reset();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      } finally {
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Send Message';
      }
    });
  }

});
 
function renderListing(p) {
  // Page title
  document.title = `${p.title} — Rolyn`;
 
  // Breadcrumb last item
  const crumbLast = document.getElementById('breadcrumb-title');
  if (crumbLast) crumbLast.textContent = p.title;
 
  // Tags row
  const tagsEl = document.querySelector('.listing-tags');
  if (tagsEl) {
    tagsEl.innerHTML = `
      <span>${escHtml(CATEGORY_LABELS[p.category] ?? p.category)}</span>
      <span class="dot">·</span>
      <span>${escHtml(TERM_LABELS[p.term] ?? p.term)}</span>
      <span class="dot">·</span>
      <span>${escHtml(REGION_LABELS[p.region] ?? p.region)}</span>
    `;
  }
 
  // Title
  const titleEl = document.querySelector('.listing-title');
  if (titleEl) titleEl.textContent = p.title;
 
  // Price
  const priceEl = document.querySelector('.listing-price');
  if (priceEl) priceEl.textContent = formatPay(p.price_min, p.price_max);
 
  // Posted time + location meta
  const metaItems = document.querySelectorAll('.meta-item');
  if (metaItems[0]) metaItems[0].querySelector('svg').insertAdjacentText('afterend', ` Posted ${timeAgo(p.created_at)}`);
  if (metaItems[1]) metaItems[1].querySelector('svg').insertAdjacentText('afterend', ` ${REGION_LABELS[p.region] ?? p.region}`);
 
  // Description section
  const descSection = document.getElementById('listing-description');
  if (descSection) {
    // Split on blank lines into paragraphs
    descSection.innerHTML = p.description
      .split(/\n\s*\n/)
      .map((para) => `<p>${escHtml(para.trim())}</p>`)
      .join('');
  }
 
  // Details grid
  const detailsGrid = document.getElementById('listing-details');
  if (detailsGrid) {
    detailsGrid.innerHTML = `
      <div class="detail"><dt>Category</dt><dd>${escHtml(CATEGORY_LABELS[p.category] ?? p.category)}</dd></div>
      <div class="detail"><dt>Term</dt><dd>${escHtml(TERM_LABELS[p.term] ?? p.term)}</dd></div>
      <div class="detail"><dt>Location</dt><dd>${escHtml(REGION_LABELS[p.region] ?? p.region)}</dd></div>
      <div class="detail"><dt>Pay</dt><dd>${formatPay(p.price_min, p.price_max)}</dd></div>
      <div class="detail"><dt>Posted</dt><dd>${new Date(p.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</dd></div>
      <div class="detail"><dt>Status</dt><dd>${p.active ? 'Active' : 'Closed'}</dd></div>
    `;
  }
 
  // Seller card
  const sellerNameEl   = document.getElementById('seller-name');
  const sellerAvatarEl = document.getElementById('seller-avatar');
  const sellerMetaEl   = document.getElementById('seller-meta');
  const messageHeadEl  = document.getElementById('message-seller-name');
 
  const name    = p.author_name ?? 'Anonymous';
  const initial = name.charAt(0).toUpperCase();
 
  if (sellerAvatarEl) sellerAvatarEl.textContent = initial;
  if (sellerNameEl)   sellerNameEl.textContent   = name;
  if (sellerMetaEl)   sellerMetaEl.textContent   = `Posted ${timeAgo(p.created_at)}`;
  if (messageHeadEl)  messageHeadEl.textContent  = `Send ${name.split(' ')[0]} a message about this listing.`;
}
 
function notFound() {
  const el = document.createElement('div');
  el.className   = 'listing';
  el.style.padding = '3rem 1.25rem';
  el.innerHTML   = `<h1>Listing not found</h1><p>This listing may have been removed or the link is incorrect.</p><a href="index.html" class="btn btn-ghost">Back to listings</a>`;
  return el;
}