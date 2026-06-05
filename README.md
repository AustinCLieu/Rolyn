# Rolyn

A Filipino community marketplace for job postings and services — think Craigslist meets Fiverr, built for the Philippines. Users can post jobs like tutoring or cleaning, offer services, or sell items, and contact each other directly through the site.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML, CSS, JavaScript (ES modules, no framework) |
| Backend | Node.js + Express 5 |
| Database | SQLite via Node's built-in `node:sqlite` (Node 22+) |
| Auth | Supabase Auth (email/password + Google OAuth) |

Supabase is used **only for authentication** — it issues and verifies JWTs. All application data (users, posts, messages) lives in the local SQLite file.

---

## Project Structure

```
Rolyn/
├── backend/
│   ├── server.js          # Express app, posts + users routes
│   ├── db.js              # SQLite connection + schema (users, posts, messages tables)
│   ├── lib/
│   │   └── supabase.js    # Supabase admin client (for JWT verification)
│   ├── middleware/
│   │   └── requireAuth.js # JWT validation middleware
│   └── routes/
│       ├── auth.js        # /api/auth/* routes (sync, profile, account)
│       └── messages.js    # /api/messages/* routes (send, inbox, thread, read)
└── frontend/
    ├── html/              # One .html file per page
    ├── css/
    │   ├── styles.css
    │   ├── listing.css
    │   ├── profile.css
    │   ├── messages.css   # Thread page + inbox card styles
    │   └── ...
    ├── js/
    │   ├── config.js      # BACKEND_URL and Supabase keys
    │   ├── supabase.js    # Supabase client instance
    │   ├── api.js         # Fetch wrapper (attaches JWT, handles errors)
    │   ├── auth.js        # Auth helpers (login, signup, profile, etc.)
    │   ├── header.js      # Header nav + search, runs on every page
    │   ├── posts.js       # Shared post API functions + formatters
    │   ├── messages.js    # Shared messaging API functions
    │   ├── index.js       # Home page feed + filters
    │   ├── create.js      # Create listing page
    │   ├── listing.js     # Single listing detail page
    │   ├── profile.js     # Profile + settings page
    │   ├── thread.js      # Message thread page
    │   ├── signup.js      # Sign up page
    │   └── forgot-password.js
    └── media/
```

---

## Local Setup

### Prerequisites
- Node.js 22 or later (required for the built-in `node:sqlite` module)

### 1. Install backend dependencies

```bash
cd backend
npm install
```

### 2. Create the environment file

Create `backend/.env`:

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

The service role key is found in your Supabase project under **Settings → API → service_role**.

### 3. Start the backend

```bash
npm run dev
```

The server starts at `http://localhost:3000`. The SQLite database file (`rolyn.db`) is created automatically on first run.

### 4. Open the frontend

The frontend must be served over HTTP — opening HTML files directly via `file://` breaks Google OAuth and Supabase redirects.

**Option A — VS Code Live Server (recommended for development)**
Install the Live Server extension, open `frontend/html/index.html`, and click **Go Live** in the bottom right.

**Option B — serve CLI**
```bash
npx serve frontend/html
```

After starting, add the local URL (e.g. `http://localhost:5500`) to your Supabase project under **Authentication → URL Configuration → Redirect URLs**.

---

## Backend API

### Posts

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/posts` | No | List posts. Filters: `category`, `region`, `term`, `user_id`, `q` (search), `limit`, `offset`, `include_inactive` (only with `user_id`) |
| GET | `/api/posts/:id` | No | Get a single post |
| POST | `/api/posts` | Yes | Create a listing |
| PATCH | `/api/posts/:id/close` | Yes + owner | Mark a post as closed |
| DELETE | `/api/posts/:id` | Yes + owner | Delete a post |

### Users

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/users/:id` | No | Get a user's public display name |

### Auth / Profile

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/auth/me` | Yes | Get current user + SQLite profile |
| POST | `/api/auth/sync` | Yes | Upsert user into SQLite (call after login) |
| PATCH | `/api/auth/profile` | Yes | Update display name, location, phone |
| DELETE | `/api/auth/account` | Yes | Delete account from Supabase + SQLite |

### Messages

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/messages` | Yes | Send a message about a listing |
| GET | `/api/messages` | Yes | Get inbox (one entry per conversation thread) |
| GET | `/api/messages/:postId/:userId` | Yes | Get full thread between two users about a post |
| PATCH | `/api/messages/:id/read` | Yes (receiver only) | Mark a message as read |

---

## Database Schema

**`users`** — one row per Supabase auth user. Keyed by Supabase UUID.
```sql
id         TEXT PRIMARY KEY   -- Supabase UUID
email      TEXT NOT NULL
full_name  TEXT
location   TEXT
phone      TEXT
created_at TEXT
```

**`posts`** — job listings, service listings, and items for sale.
```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
user_id     TEXT               -- references users.id
author_name TEXT
title       TEXT
category    TEXT               -- cleaning | cooking | service | kidcare | transportation
description TEXT
region      TEXT               -- manila | ncr | cebu | davao
term        TEXT               -- onetime | daily | weekly | monthly | yearly
price_min   INTEGER
price_max   INTEGER
active      INTEGER            -- 1 = active, 0 = closed
created_at  TEXT
```

**`messages`** — messages between users about a specific listing.
```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
post_id     INTEGER NOT NULL   -- references posts.id
sender_id   TEXT NOT NULL      -- references users.id
receiver_id TEXT NOT NULL      -- references users.id
content     TEXT NOT NULL
read        INTEGER            -- 0 = unread, 1 = read
created_at  TEXT
```

---

## Auth Flow

1. User signs up or logs in via Supabase (email/password or Google OAuth)
2. Supabase returns a JWT stored in the browser by the Supabase SDK
3. Frontend calls `POST /api/auth/sync` to create the user's SQLite row
4. Every subsequent API request includes `Authorization: Bearer <jwt>` via `api.js`
5. Backend `requireAuth` middleware verifies the JWT by calling Supabase, then attaches `req.user` for route handlers to use
