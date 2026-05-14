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
    return await supabase.auth.signInWithPassword({ email, password });
}