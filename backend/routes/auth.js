// All routes under /api/auth/* live here. This is the backend's "who am I" and "manage my account" surface area.
// This file doesn't handle login or signup, those occur in frontend through supabase auth. 

import express from 'express'; // we use express to build the router
import { requireAuth } from '../middleware/requireAuth.js'; // we use requireAuth function we made cuz every route in this file is protected cuz there's no "who am I" endpoint that is public, needs to verify JWT

// Later, when /me starts fetching profile data, we'll also need:
// import { supabase } from '../lib/supabase.js';

const router = express.Router(); // creates a mini Express app that we attach routes to. 

// '/me' is the path (becomes /api/auth/me after mounting)
// requireAuth runs first, validates the JWT, and attaches req.user. If the JWT is bad, it sends 401 and the handler never runs
// Handler only runs if requireAuth calls next(). Echoes req.user back as JSON
router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
    // Right now, this only echos req.user. Later, after we build the 'profiles' table, we'll fetch and include other things in the route.
    // The JWT only includes supabase's built in auth.users field. We will include things like display_name, location, etc
    /*
    const { data, profile } = await supabase
        .from('profiles')
        .select('display_name, location, phone, avatar_url')
        .eq('id', req.user.id)
        .single();
    res.json({ user: req.user, profile });
    must make handler async when we do this cuz we now querying from db
    */
});

/*
Future routes that will prob live in this file
POST /api/auth/profile
PATCH /api/auth/profile
POST /api/auth/avatar
DELETE /api/auth/account
What is NOT in this file
POST /login
POST /signup
POST /logout
Anything that issues or refreshes JWTs
*/

// Makes the router importable from server.js
// Default means "this is the main thing this file exports", no curly braces are needed
export default router;