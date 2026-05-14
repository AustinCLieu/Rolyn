// This file is the entry point of our backend. It's what runs after npm run dev.
// It's responsible for creating an express application, configuring how the app behaves (middleware, json parsing, etc), telling the app which URLs go to which route files, starting the server to listen for incoming requests

import express from 'express'; // 
import cors from 'cors'; // middleware that handles CORS browser security, stops browser from blocking calling on different ports
import dotenv from 'dotenv'; // reads .env file
import authRouter from './routes/auth.js' // authRouther

dotenv.config(); // reads .env and populates process.env with the contents

const app = express(); // returns a new application object. We'll configure, attach middleware, routes, and tell app to start listening

// app.use(...) adds middleware that runs on every request
app.use(cors()); // calls the cors function which returns express middleware and attaches it. Middleware looks at it and adds the right CORS response headers so browsers will allow the response. We can add specific origins in prod
app.use(express.json()); // built in express middleware that parses incoming JSON request bodies. Attaches parsed object to req.body

// This is the URl to file mapping. 
// app.use(prefix, router) attaches a router at a URL prefix. Any request whose URL starts with /api/auth gets handed to authRouter to deal with
// Inside authRouter, such as routes/auth.js, the routes use relative paths like /me. The prefiux gets prepended automatically so router.get('/me', ...) become the URL /api/auth/me from outside
// When we build routes/posts.js later, we'll add another line here (app.use('/api/posts', postsRouter)). The pattern repeats
app.use('/api/auth', authRouter); // Without this line, Express has no idea routes/auth.js exists. This activates the auth routes

// Tis is a route defined on app insatead of going through a router. It just lets us check if it's on bu running localhost:3000/api/health and seeing status: ok
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
})

// Starts the server. 
const PORT = process.env.PORT || 3000; // Reads the PORT value from .env file. If not set there, fall back to 3000
app.listen(PORT, () => { // actually starts the server
    console.log(`Server on http://localhost:${PORT}`); // prints the URL so we know the server is up
});