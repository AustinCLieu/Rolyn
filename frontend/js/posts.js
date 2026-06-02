// js/posts.js — shared API helpers used by create, index, and listing pages
 
const API = 'http://localhost:3000/api';
 
// Fetch all posts, with optional filters { category, region, term }
export async function fetchPosts(filters = {}) {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.region)   params.set('region',   filters.region);
  if (filters.term)     params.set('term',      filters.term);
 
  const url = `${API}/posts${params.toString() ? '?' + params : ''}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error('Failed to load posts.');
  return res.json();
}
 
// Fetch a single post by id
export async function fetchPost(id) {
  const res = await fetch(`${API}/posts/${id}`);
  if (!res.ok) throw new Error('Post not found.');
  return res.json();
}
 
// Create a new post
export async function createPost(data) {
  const res = await fetch(`${API}/posts`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Failed to create post.');
  return json;
}
 
// Mark a post as closed
export async function closePost(id) {
  const res = await fetch(`${API}/posts/${id}/close`, { method: 'PATCH' });
  if (!res.ok) throw new Error('Failed to close post.');
  return res.json();
}
 
// Delete a post
export async function deletePost(id) {
  const res = await fetch(`${API}/posts/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete post.');
  return res.json();
}
 
// ── Formatting helpers shared across pages ──
 
export const CATEGORY_LABELS = {
  cleaning:       'Cleaning',
  cooking:        'Cooking',
  service:        'Service',
  kidcare:        'Kid care',
  transportation: 'Transportation',
};
 
export const REGION_LABELS = {
  manila: 'Manila',
  ncr:    'Metro Manila (NCR)',
  cebu:   'Cebu',
  davao:  'Davao',
};
 
export const TERM_LABELS = {
  onetime: 'One time',
  daily:   'Daily',
  weekly:  'Weekly',
  monthly: 'Monthly',
  yearly:  'Yearly',
};
 
export function formatPay(min, max) {
  if (min == null) return '—';
  const fmt = (n) => Number(n).toLocaleString('en-PH', { maximumFractionDigits: 0 });
  if (max && Number(max) > Number(min)) return `₱${fmt(min)}–₱${fmt(max)}`;
  return `₱${fmt(min)}`;
}
 
export function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)   return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}
 
export function escHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}