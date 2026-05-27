// this file wraps around supabase auth files so that our project has easy functions
import { supabase } from './supabase.js';

// when we run this function, the browser navigates to Google's login page. 
// After the user signs in, Google redirects back to our website, Supabase notices the redirect, extracts the JWt from the URL, stores it in localStorage, and the user is now logged in. 
export async function signInWithGoogle() { //async cuz this takes time, so we await inside it
    const { error } = await supabase.auth.signInWithOAuth({ // supabase.auth.signInWithOAuth is the Supabase function that handles OAuth. The arg is a config object
        provider: 'google', // tells Supabase which OAuth provider to use, we want Google sign in
        options: { redirectTo: window.location.origin } // redirects to the current page's domain
    });
    if (error) console.error(error); // log if something went wrong
    // signInWithOAuth returns { data, error } but we only care about error because the real result (the login) happens after the redirect, not in this function's return value
}

// for users who sign in with email password instead of Google. 
export async function signInWithEmail(email, password) { // takes email and password as args. Our sign in form will pass them in
    // Supabase verifies the password against its stored hash and returns a JWT if it matches. Return await returns a { data, error } object, so when we call this function, we can use error to check if it worked 
    return await supabase.auth.signUp({
        email,
        password,
        options: {
            data: metadata   // stored as user.user_metadata
        }
    });
}

// creates a new user. Supabase will hash the password, insert a row into the auth.users table, and will log them in or immediately send a confirmation email (default is email)
export async function signUp(email, password) {
    return await supabase.auth.signUp({ email, password });
}

// Cleares the JWT from localStorage and tells Supabase to invalidate the session. This means the user is no longer logged in and protected routes to the backend shouldn't work anymore, such as making a post
export async function signOut() {
    return await supabase.auth.signOut();
}

// this function returns the current session info if the user is logged in, and null if not. It's useful for "am I logged in rn?"
// It also returns the JWT itself which is useful when calling backend. The returned shape looks like
/*
{
    data: {
        session: {
            access_token: 'eyJ...',
            r3efresh_token: '...',
            expires_at: 1735689600
            user: { 
                id: 'abc-123-...', 
                email: 'beastcs146j@gmail.com'
                user_metadata: { full_name: 'Austin' },
                //
            },
        }
    },
    error: null
}
So to grab the JWT specifically, we use (await getSession()).data.session.access.token
Everytime our frontend calls a protected route api to our backend endpoint, we need the JWT to verify user is logged in so we'll use getSession to get it. This is what api.js helper is for.
Whenever a page loads, a question is "am I logged in?". We'll use getsession to determine here.
Some pages should only work when logged in such as our my-posts page. We use getSession here
When the user creates a post, there may be info we want to attach/prefill such as contact info or display name. This prevents an extra backend call
IMPORTANT: We can add something called onauthstatechange, lets do later, whenever something depends on loginstate so it immediately checks for logged in change
*/
export async function getSession() {
    return await supabase.auth.getSession();
}