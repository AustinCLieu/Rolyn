// posts.js — shared API helpers used by create, index, listing, and profile pages.
//
// All requests go through api.js instead of raw fetch() for two reasons:
// 1. api.js automatically attaches the JWT header, which the backend requires for
//    write operations (createPost, closePost, deletePost). Without it they return 401.
// 2. api.js prepends BACKEND_URL so we only write paths like /api/posts, not full URLs.

import { api } from './api.js';

// Fetch a page of posts. Filters: { category, region, term, q, limit, offset }
// Returns { posts: [...], hasMore: bool } — matches the backend's paginated response shape.
export async function fetchPosts(filters = {}) {
  const params = new URLSearchParams();
  if (filters.category)      params.set('category', filters.category);
  if (filters.region)        params.set('region',   filters.region);
  if (filters.term)          params.set('term',      filters.term);
  if (filters.q)             params.set('q',         filters.q);
  if (filters.limit  != null) params.set('limit',   String(filters.limit));
  if (filters.offset != null) params.set('offset',  String(filters.offset));

  const qs = params.toString();
  return api.get(`/api/posts${qs ? '?' + qs : ''}`);
}

// Fetch a single post by id.
export async function fetchPost(id) {
  return api.get(`/api/posts/${id}`);
}

// Create a new post. Requires the user to be logged in — api.js attaches the JWT.
export async function createPost(data) {
  return api.post('/api/posts', data);
}

// Mark a post as closed (inactive). Requires login and ownership.
export async function closePost(id) {
  return api.patch(`/api/posts/${id}/close`, {});
}

// Permanently delete a post. Requires login and ownership.
export async function deletePost(id) {
  return api.delete(`/api/posts/${id}`);
}

// ── Formatting helpers shared across pages ──

export const CATEGORY_LABELS = {
  // Services
  cleaning:       'Cleaning',
  cooking:        'Cooking',
  kidcare:        'Kid Care',
  transportation: 'Transportation',
  tutoring:       'Tutoring / Education',
  beauty:         'Beauty & Wellness',
  repairs:        'Repairs & Maintenance',
  construction:   'Construction & Labor',
  errands:        'Errands & Delivery',
  events:         'Events & Entertainment',
  caregiving:     'Caregiving',
  service:        'General Service',
  // Items for sale
  electronics:    'Electronics',
  furniture:      'Furniture & Home',
  clothing:       'Clothing & Accessories',
  vehicles:       'Vehicles & Parts',
  food:           'Food & Produce',
  instruments:    'Instruments & Hobbies',
  items:          'Other Items',
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
  const diff = Math.floor((Date.now() - parsePostDate(dateStr)) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

export function parsePostDate(dateStr) {
  if (!dateStr) return new Date(NaN);
  if (dateStr.includes('T')) return new Date(dateStr);
  return new Date(dateStr.replace(' ', 'T') + 'Z');
}

export function formatPostedAt(dateStr) {
  const d = parsePostDate(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  });
}

export function escHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
