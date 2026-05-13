// This is the gate that sits in front of every PROTECTED route (frontend asks backend for something, but it needs the user to be logged in). 
// This means that we'll use this file if a user is logged in and wants to make a post, but not if we just want to see all the posts which is a situation where we don't need to verify JWT cuz we don't gotta be logged in to do that
// It looks as the incoming request, checks if the user has a valid JWT, and it lets the request through or denies it
// In express, every incoming request becomes an object called req. It has built in properties like req.body (JSON body), req.params (URL parameters like :id), req.headers (the HTTP headers)
// We can add your own properties at any point in the middleware chain. We will add req.user so later code knows whos (what user) is making the request

import { supabase } from '../lib/supabase.js'; // this bootgangs yeeeet the supabase client we made in lib/supabase, broski lets us use the supabase connection

// every express middleware is a function that takes 3 args, req (the request), res (the response), next (aw callback that passes control to the next middleware or route handler)
// calling next() means "I'm done, pass this request to the next thing". Not calling and sending a response with res.status(...).json(...) instead means "stop here, the request is done"
export async function requireAuth(req, res, next) {
    // 1. Get the authorization header
    const authHeader = req.headers.authorization; // gives us the whole authorization string. Ex: "Bearer fgerukghaesdklgdagag" fdlkhgfdladg is the jwt

    // 2. Check that it exists and is formatted correctly
    // Checks for two failure cases: !authHeader checks for no header at all (user not logged in or frontend trolling), other checks for header existing but it being malformed, didn't have 'Bearer '
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or malformed token' }); // return 401 unauthorized and stop (we didn't call the next() function so we didn't move on, we just end here)
    }

    // 3. Extract the actual token (everything after "Bearer " because the auth header looks like "Bearer " followed by the JWT)
    const token = authHeader.split(' ')[1]; // splitting on the space and doing [1] gives us index [1], the second part of the string, which is the JWT

    // 4. Yo Supabase check that this JWT is valid, so basically check that this a real valid user broski
    // The return shape is { data: { user }, error } so it returns the user object after looking up the user in the database, or it returns an error if something failed
    // We can only use this supabase tool because were using it with the secret BEAST admin service_role key that lets us access everything in the supabase database
    const { data, error } = await supabase.auth.getUser(token); // haahahahhajhaha W cs146J we learn async await

    // 5. If it was an invalid JWT or the token expired, we reject that jawn
    if (error || !data.user) { // either Supabase returned an error, or data.user is null (no user matched the jwt)
        return res.status(401).json({ error: 'Invalid or expired token' }); // return 401 invalid or expired token
    }

    // 6. Attach the user to the request and continue
    // attaches data.user to the request. data.user is an object that looks like:
    /*
    { 
        id: 'a1b2c...', (this is the user's UUID, the most important one saying what user this is)
        email: 'beastmodecs146jfinalgroup@gmail.com', (pretty sure this one important too cuz we gotta send emails as part of our backend)
        user_metadata: { full name: 'Austin' },
        created_at: '2024-...',
        other fields
    }
    this lets us do stuff like req.user.id to get the UUID, req.user.email to get the email, we will use these in other code where next() goes
    */
    req.user = data.user;
    next(); // booom this is the next() function we talked about earlier that lets us move on. Now everything in the future will see this valid req.user when it does whatever is asked for

}