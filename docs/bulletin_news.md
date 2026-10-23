# Bulletin (News / Announcement) Feature

A company-wide announcement channel. Admins publish bulletins with a title, body and an
optional PNG; every staff member sees a notification bell on their avatar with an unread
count, and a one-per-day carousel modal showing the 3 latest bulletins.

---

## 1. User stories

| Actor | Story |
|-------|-------|
| Admin | I open **Bulletin** in the sidebar and publish an announcement with an optional PNG. |
| Admin | I edit or delete a bulletin I published. Deleting also removes the PNG from disk. |
| Staff  | I see a bell on my avatar with a red unread badge. |
| Staff  | I click the bell to list bulletins and mark them read (individually or all at once). |
| Staff  | On my first visit of the day, the 3 latest bulletins appear in a carousel modal. |
| Staff  | If there are no bulletins published, **no modal appears at all**. |

---

## 2. Business rules

| Rule | Detail |
|------|--------|
| Publishing | **Admin only.** Managers, directors and staff get `403 Access denied`. |
| Image | Optional. When supplied it must be a **PNG** (`image/png` only) and **≤ 5 MB**. |
| Image storage | `backend/uploads/news/<timestamp>-<random>.png`, served from `/uploads/news/...`. |
| Read state | **Manual.** The badge clears only via "Mark read" / "Mark all as read". |
| Dismissing the daily modal | Does **not** mark anything as read — the badge keeps its count. |
| Daily modal | Shows the **3 newest** published bulletins, **once per user per day** (MYT). |
| Daily gate | `news_user_state.last_popup_date` vs `CURRENT_DATE AT TIME ZONE 'Asia/Kuala_Lumpur'`. |
| No bulletins | `shouldShow` is `false` and the modal never renders. |
| Ordering | Newest first (`created_at DESC`). |
| Audit | Publish / update / delete are written to `admin_logs` via `logAdminAction`. |

---

## 3. Data model

Added at the end of `backend/db/schema.sql`.

### `news_items`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `SERIAL PRIMARY KEY` | |
| `title` | `TEXT NOT NULL` | |
| `body` | `TEXT NOT NULL` | |
| `image_path` | `TEXT` | nullable — relative path e.g. `/uploads/news/1234-567.png` |
| `created_by` | `TEXT NOT NULL` | `profiles.staff_id` of the author |
| `created_by_name` | `TEXT` | denormalised display name |
| `status` | `TEXT NOT NULL DEFAULT 'published'` | only `published` rows are served |
| `created_at` | `TIMESTAMP NOT NULL DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMP` | |

### `news_reads`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `SERIAL PRIMARY KEY` | |
| `news_id` | `INTEGER NOT NULL` | FK → `news_items(id)` `ON DELETE CASCADE` |
| `staff_id` | `TEXT NOT NULL` | reader |
| `read_at` | `TIMESTAMP NOT NULL` | |

Unique key on `(news_id, staff_id)` — one row per reader per bulletin.

### `news_user_state`

| Column | Type | Notes |
|--------|------|-------|
| `staff_id` | `TEXT PRIMARY KEY` | |
| `last_popup_date` | `DATE` | last day the daily modal was shown |

### Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_news_items_created_at ON news_items (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_reads_staff      ON news_reads (staff_id);
CREATE INDEX IF NOT EXISTS idx_news_reads_news       ON news_reads (news_id);
```

---

## 4. API reference

Base path: `/api/news`. All endpoints require an authenticated session
(`auth_token` cookie) → otherwise `401 Not authenticated`.

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| GET | `/api/news` | any | List published bulletins + `unread_count` |
| GET | `/api/news/unread-count` | any | Badge count only (polled every 30 s) |
| GET | `/api/news/daily` | any | 3 latest bulletins + `shouldShow` flag |
| POST | `/api/news/popup-seen` | any | Record that the daily modal was shown today |
| POST | `/api/news/:id/read` | any | Mark one bulletin read for the current user |
| POST | `/api/news/read-all` | any | Mark every published bulletin read |
| POST | `/api/news` | **admin** | Publish a bulletin (`multipart/form-data`, field `image` optional) |
| PUT | `/api/news/:id` | **admin** | Update a bulletin (same multipart shape) |
| DELETE | `/api/news/:id` | **admin** | Delete a bulletin (and its PNG from disk) |

### Query parameters

- `GET /api/news?limit=50&offset=0` — `limit` is capped at 200.

### Response shapes

```jsonc
// GET /api/news
{
  "items": [
    {
      "id": 12,
      "title": "Company Town Hall - 12 Jan",
      "body": "All staff are required to attend.",
      "image_path": "/uploads/news/1792634493609-563811912.png",
      "created_by": "E0001",
      "created_by_name": "System Administrator",
      "created_at": "2026-10-22T09:14:53.609Z",
      "updated_at": null,
      "is_read": false,     // for the current user
      "read_count": 0       // how many staff have read it
    }
  ],
  "unread_count": 3
}
```

```jsonc
// GET /api/news/unread-count
{ "unread_count": 3 }

// GET /api/news/daily
{
  "shouldShow": true,      // false when there is no news OR already shown today
  "items": [ /* max 3 */ ]
}
```

```jsonc
// POST /api/news  (201 Created)
{ "success": true, "news": { /* the created row */ } }

// POST /api/news/:id/read  (200 OK)
{ "success": true }

// POST /api/news/read-all  (200 OK)
{ "success": true, "marked": 3 }

// DELETE /api/news/:id  (200 OK)
{ "success": true }
```

### Errors

| Status | When |
|--------|------|
| `400` | Upload rejected — `Only PNG images are allowed`, or file over 5 MB. |
| `401` | Not authenticated. |
| `403` | Authenticated but not an admin (`Access denied`). |
| `404` | Bulletin id does not exist. |

---

## 5. Frontend structure

```
frontend/src/lib/components/news/
├── NewsBell.svelte          # bell + unread badge + dropdown panel
├── NewsCarouselModal.svelte # 3-slide carousel modal (daily popup + manual re-open)
├── NewsManager.svelte       # admin CRUD UI (grid + add/edit modal + delete)
└── newsStore.js             # tiny store shared by the bell and the carousel

frontend/src/routes/dashboard/admin/bulletin/+page.svelte   # admin route
```

### `NewsBell`

- Rendered inside `.profile-info` (which is `position: relative`) so the bell sits at the
  **top-left of the avatar**.
- Badge shows the unread count, capped at `9+`.
- Opens a dropdown listing bulletins with a thumbnail, title, date and a "Mark read"
  button; "Mark all as read" in the panel header.
- The **"Notifications" heading** of the dropdown is a button - clicking it re-opens the
  carousel modal (see below). Each bulletin **title** in the list is a button as well and
  opens the carousel directly on that bulletin.
- Polls `/api/news/unread-count` every 30 s, and refreshes when the tab becomes visible.
- Listens for the `window` `news-updated` event so the admin page and the bell stay in sync.

### `NewsCarouselModal`

- On mount calls `GET /api/news/daily`.
- Opens **only** when `shouldShow === true` **and** `items.length > 0` → with no bulletins
  published the modal never appears.
- When it opens it immediately POSTs `/api/news/popup-seen`, so it shows once per day per user.
- Prev / next buttons, dot indicators, `←` `→` arrow keys and `Esc` to close.
- Closing does **not** mark the bulletins as read.
- **Manual re-open** - `newsStore.js` holds a request counter (`{ id, startId }`). The bell
  calls `openCarousel(startId)`, the modal subscribes to the store and opens on demand,
  ignoring the once-per-day gate. The request is handled in a store subscription (not a
  `$:` block) so that closing the modal does not re-trigger it. A manual open also POSTs
  `/api/news/popup-seen`, so the automatic popup stays closed for the rest of the day.

### `NewsManager` (admin)

- Card grid with thumbnail, title, excerpt, date, author and the read count.
- Add / edit modal with title, body, optional PNG (with preview + remove) and validation.
- Delete asks for confirmation, then removes the bulletin and its PNG.
- Dispatches `window` `news-updated` after every mutation.

### Wiring

- All four sidebars import and render `<NewsBell />` + `<NewsCarouselModal />`:
  `Sidebar.svelte` (admin), `StaffSidebar.svelte`, `ManagerSidebar.svelte`,
  `DirectorSidebar.svelte`.
- `.profile-info` gets `position: relative`; `.avatar-fallback` (the placeholder shown when
  a user has no photo) is sized `70px` desktop / `44px` on mobile to match `.avatar-img`.
- `frontend/src/routes/+layout.svelte` maps `/bulletin` → the `Bulletin` page title.

---

## 6. SSR caveat (important)

SvelteKit renders these pages on the server. In SSR:

- `onMount` does **not** run.
- `onDestroy` **does** run, during render teardown.

So any `document` / `window` access inside `onDestroy` throws
`ReferenceError: document is not defined` and the page returns **HTTP 500**.

**Rule:** never touch `document` or `window` outside `onMount`. Return the cleanup
function from `onMount` instead of registering a separate `onDestroy`:

```js
onMount(() => {
  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);   // client only
});
```

`NewsBell.svelte` and `NewsCarouselModal.svelte` both follow this pattern.

---

## 7. Manual test steps

Prerequisites: the `news_items`, `news_reads` and `news_user_state` tables must exist in
the target database (see [LOCAL_DB_SETUP.md](./LOCAL_DB_SETUP.md)).

```bash
# terminal 1 - backend
npm start --prefix backend

# terminal 2 - frontend
npm run dev --prefix frontend
```

1. Log in as an admin (seeded local credentials: `admin@eftech.com.my` / `Admin@123!`).
2. Open **Bulletin** in the sidebar → publish a bulletin with a PNG → confirm it appears
   in the grid with a `0` read count.
3. Publish two more bulletins so the daily carousel has three slides.
4. Confirm the bell shows `3`.
5. Open the bell → "Mark all as read" → the badge disappears.
6. Reload → the daily carousel modal shows the 3 newest bulletins.
7. Close the modal and reload → it does **not** reappear the same day.
8. Open the bell and click the **"Notifications" heading** → the carousel appears again
   (the daily gate is bypassed). Clicking a bulletin **title** in the list opens the
   carousel on that bulletin.
9. Delete every bulletin → reload → **no modal appears** and the badge is gone.
10. Log in as a staff account → the bell is visible, the admin's read state does not carry
    over, and the staff member gets their own daily modal.
11. Try publishing as staff/manager → `403 Access denied`.

---

## 8. Related files

| File | Role |
|------|------|
| `backend/src/routes/newsRoutes.js` | The whole feature's backend API |
| `backend/server.js` | Mounts the router at `/api/news` |
| `backend/db/schema.sql` | `news_items`, `news_reads`, `news_user_state` + indexes |
| `backend/src/middleware/adminLogger.js` | `logAdminAction` — admin audit trail |
| `frontend/src/lib/components/news/*` | Bell, carousel modal, admin manager, shared store |
| `frontend/src/routes/dashboard/admin/bulletin/+page.svelte` | Admin page |
