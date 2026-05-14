/*
api.js is a thin wrapper around fetch(). It handles the following 3 things:
1. Base URL - we write /api/posts, it sends to http://localhost:3000/api/posts. When we deploy, we'll change the URL in config.js
2. JWT Attachment - It grabs the current supabase session which is JWT of current user, and it adds the Authorization: Bearer <jwt> header so every page that uses it gets authenticated calls for free
3. JSON Handling - sets Content-Type: application/json, serializes the body, parses the response, and throws on HTTP errors
This is conveninent. Without api.js, we would be repeating the same lines of boilerplate on every single page script. 
This is a bridge between the frontend pages and every protected endpoint in the backend.
api.js will be called for:
AUTH ROUTES
api.get('/api/auth/me') - getting current user and profile
api.post('/api/auth/profile', { display_name, region }) - creating a profile after signup
api.patch('/api/auth/profile', { display_name, region }) - update profile
api.post('/api/auth/avatar', formData) - upload avatar (uses FormData, not JSON)
POSTS ROUTES
api.get('/api/posts?category=tutoring&region=ncr') - public, but JWT attached if logged in
api.get('/api/posts/' + id) - public, single post
api.post('/api/posts', { title, description, category, region, price }) - protected
api.patch('/api/posts/' + id, { title, description, ... }) - owner only, protected
api.delete('/api/posts/' + id) - owner only, protected
api.post('/api/posts/' + id + '/images', formData) - file upload
api.delete('/api/posts/' + id + '/images/' + imageId) - owner only, protected
PROFILES ROUTES
api.get('/api/profiles/' + userId) - public
MESSAGES ROUTES (All protected)
api.get('/api/messages/conversations') - inbox list
api.get('/api/messages/' + userId) - full thread with one user
api.post('/api/messages', { receiver_id, content }) - sending a message

Since api.js also works on publci routes, api.js should attach the JWT if available, but it shouldn't fail if there is no session
*/

import { BACKEND_URL } from './config.js'; // should be localhost for now and then real host later
import { getSession } from './auth.js'; // returns current supabase session, wrapper we made

async function request(path, options = {}) {
    // pulls the JWT from the current session, if the user is logged in
    const session = await getSession(); // ask Supabase what the current session is
    const jwt = session?.access_token; // ?. is optional chaining. If session is null (user not logged in), undefined is returned instead of crashing. access_token is the JWT property

    // Start with whatever headers the caller has passed in (prob none)
    const headers = { ...BACKEND_URL(options.headers || {}) }; // copy any caller supplied headers. Custom headers are rarely passed. Preserves them if there are

    // For JSON bodies, set Content-Type. For FormData (file/image uploads), don't set it, the browser sets it automatically with the correwct multipart boundary (multipart/form-data; boundary=...) is needed for file upload
    if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    // Attach the actual JWT if available. Public routes don't need it, but there is no harm in sending it along
    if (jwt) {
        headers['Authorization'] = `Bearer ${jwt}`;
    }

    // Make the actual request
    const res = await fetch(`${BACKEND_URL}${path}`, { // prepend the base url, BACKEND_URL/api/posts becomes http://localhost:3000/api/posts
        ...options,
        headers,
    });

    // Throw on HTTP errors so callers can try/catch
    if (!res.ok) { // okay for status code 200-299, not okay for anything else like 401 Unauthorized, 404 Not Found, etc
        const errorText = await res.text();
        throw new Error(`API error ${res.status}: ${errorText}`);
    }

    // Parse JSON response, or return null for empty responses (ex: DELETE)
    // Most endpoints return JSON, but not all do, such as how DELETE might return 204 No Content. Calling res.json() on an empty body throws. Checking content-type first avoids this
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return res.json();
    }
    return null;
}

// api object is the public interface. It has four methods, one for each HTTP verb we need
export const api = {
    get: (path) => // no body needed
        request(path, { method: 'GET' }),

    post: (path, body) => // accepts either a JS object (gets JSON-stringified) or a FormData (passed through as-is for file uploads)
        request(path, {
            method: 'POST',
            body: body instanceof FormData ? body : JSON.stringify(body),
        }),

    patch: (path, body) => // always JSON. Used for updates, like updating a post
        request(path, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),

    delete: (path) => // no body needed to delete something
        request(path, { method: 'DELETE' }),
};


