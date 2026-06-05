// auth.js — thin wrappers around Supabase Auth + our backend profile endpoints.
// All pages import from here so auth logic stays in one place.

import { supabase } from './supabase.js';
import { api }      from './api.js';

// Redirect to Google's login page. After sign-in, Google redirects back here,
// Supabase picks up the OAuth tokens, and the user is logged in.
export async function signInWithGoogle() {
  // window.location.origin is "null" when opening HTML as a file:// URL, which
  // Google OAuth rejects. Fall back to the current href so at minimum Supabase
  // gets a real URL. The proper fix is to serve the frontend over HTTP.
  // Redirect back to the current page after Google OAuth completes.
  // Using window.location.href instead of origin so the full path is preserved
  // (e.g. http://127.0.0.1:5500/frontend/html/index.html, not just the root).
  const redirectTo = window.location.href.split('#')[0].split('?')[0];
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) console.error(error);
}

// Bug fix: the original code called supabase.auth.signUp here, which creates a new
// account instead of signing in. The correct method is signInWithPassword.
export async function signInWithEmail(email, password) {
  return await supabase.auth.signInWithPassword({ email, password });
}

// Creates a new Supabase auth user. metadata is stored as user_metadata on the JWT
// and is picked up by /api/auth/sync when the user first logs in.
// Bug fix: the original function ignored the metadata parameter entirely.
export async function signUp(email, password, metadata = {}) {
  return await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });
}

export async function signOut() {
  return await supabase.auth.signOut();
}

// Returns the full Supabase session object including the JWT (access_token).
// api.js calls this automatically on every request so you rarely need it directly.
export async function getSession() {
  return await supabase.auth.getSession();
}

// syncUser — tells the backend to create or refresh the user's row in SQLite.
// Must be called after every login so the SQLite users table stays current.
// It's safe to call multiple times — the backend does an upsert (no duplicate rows).
export async function syncUser() {
  try {
    return await api.post('/api/auth/sync', {});
  } catch (err) {
    console.error('User sync failed:', err);
  }
}

// updateProfile — saves display name, location, and/or phone to SQLite via the backend.
// Returns { profile, error } so callers can check for failures the same way as Supabase calls.
export async function updateProfile({ full_name, location, phone }) {
  try {
    const result = await api.patch('/api/auth/profile', { full_name, location, phone });
    return { profile: result.profile, error: null };
  } catch (err) {
    return { profile: null, error: { message: err.message } };
  }
}

// updateUserEmail — asks Supabase to send a confirmation email to the new address.
// The change only takes effect after the user clicks the confirmation link.
export async function updateUserEmail(newEmail) {
  return await supabase.auth.updateUser({ email: newEmail });
}

// updateUserPassword — updates the password in Supabase Auth.
// The user must already be logged in (this is not a forgot-password flow).
export async function updateUserPassword(newPassword) {
  return await supabase.auth.updateUser({ password: newPassword });
}

// deleteAccount — removes the user from Supabase Auth and all their data from SQLite.
// Returns { error } in the same shape as Supabase so profile.js error handling works.
export async function deleteAccount() {
  try {
    await api.delete('/api/auth/account');
    return { error: null };
  } catch (err) {
    return { error: { message: err.message } };
  }
}

// getUserListings — fetches all posts (active and closed) owned by a given user.
// include_inactive=true is safe here because user_id is always present — the backend
// only allows inactive posts to be included when scoped to a specific user.
// Returns { data, error } so the caller can check both cases.
export async function getUserListings(userId) {
  try {
    const result = await api.get(`/api/posts?user_id=${encodeURIComponent(userId)}&include_inactive=true`);
    return { data: result.posts, error: null };
  } catch (err) {
    return { data: null, error: { message: err.message } };
  }
}
