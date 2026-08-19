# Frontend Lead Management API

Base URL: `http://localhost:3001` (or the deployed API origin).  
CORS origin is `FRONTEND_URL` (default `http://localhost:3000`) with `credentials: true`. Allowed methods: `GET`, `POST`, `PATCH`, `DELETE`, `OPTIONS`.

Every request below **must** use `credentials: "include"` so the `admin_token` cookie is sent. Auth is the same as [frontendAdminDashboard.md](./frontendAdminDashboard.md): login → OTP → cookie. Missing/invalid cookie → `401` `{ "error": "Unauthorized" }`.

A lead is basic contact info plus a **priority** string. Status history lives in `pipelines` (append-only). Notes are a separate list. Soft-deleted leads (`is_deleted = true`) are hidden from all reads and return `404`.

---

## Route map

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/admin/leads` | Create a lead |
| `GET` | `/admin/leads` | Paginated lead list (excludes deleted) |
| `GET` | `/admin/leads/status` | Dashboard counts |
| `GET` | `/admin/leads/:id` | Lead detail + all pipelines + all notes |
| `PATCH` | `/admin/leads/:id` | Edit lead details |
| `DELETE` | `/admin/leads/:id` | Soft-delete a lead |
| `POST` | `/admin/pipeline` | Append a status row |
| `POST` | `/admin/notes` | Add a note |
| `PATCH` | `/admin/notes/:id` | Edit a note |

There is no update-pipeline endpoint. To change status, `POST /admin/pipeline` with a new `status` string.

`priority` and pipeline `status` are **strings from the frontend**, not DB enums. For the status dashboard, high-priority count matches `priority` case-insensitively equal to `"high"`.

IDs:

- lead: `ld_...`
- note: `nt_...`
- pipeline: `pl_...`

---

## Shared types

```ts
export type ApiError = {
  error: string;
};

export type AdminListQuery = {
  page?: number; // default 1, min 1
  limit?: number; // default 20, min 1, max 100
  name?: string; // ILIKE on lead name
  email?: string; // ILIKE on lead email
  order?: "asc" | "desc"; // updated_at, default "desc"
};

export type AdminListResponse<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
```

List query example:

```
GET /admin/leads?page=1&limit=20&name=Jane&email=jane@&order=desc
```

`name` and `email` are optional and combined with AND when both are present.

### Error statuses

| Status | When |
|---|---|
| 400 | Validation failed (Zod). `{ error: string }` |
| 401 | Missing cookie, invalid JWT |
| 404 | Lead or note not found (including soft-deleted leads) |
| 500 | Server error |

---

## Domain types

```ts
export type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  secondaryEmail: string | null;
  secondaryPhone: string | null;
  priority: string | null; // frontend string, e.g. "high" | "medium" | "low"
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

export type LeadListItem = Lead & {
  latestStatus: string | null;
  totalNoteCount: number;
  lastNote: string | null;
  lastNoteCreatedAt: string | null; // ISO, or null if no notes
};

export type PipelineItem = {
  id: string;
  status: string; // frontend-defined string, not an enum
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

export type NoteItem = {
  id: string;
  note: string;
  notedBy: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

export type LeadDetail = Lead & {
  pipelines: PipelineItem[]; // oldest → newest
  notes: NoteItem[]; // oldest → newest
};

export type LeadStatusCounts = {
  total: number;
  highPriority: number; // priority lowercased === "high"
  todayCount: number; // created today (server local day)
  weekCount: number; // created in the last 7 days
  monthCount: number; // created in the last 30 days
};
```

`latestStatus` is the `status` of the newest pipeline row for that lead, or `null` if none exist.  
`lastNote` / `lastNoteCreatedAt` come from the newest note, or `null` if none exist.

Deleted leads are never returned. `isDeleted` is not included in JSON.

---

## Leads

Cookie required.

### `POST /admin/leads`

**Request**

```ts
type CreateLeadRequest = {
  name: string; // required, min 1
  email: string; // required, valid email
  phone: string; // required, min 1
  secondaryEmail?: string | null; // valid email, "" or null → stored as null
  secondaryPhone?: string | null;
  priority?: string | null; // any string; "" or null → stored as null
};
```

Example:

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+44 7700 900123",
  "secondaryEmail": "jane.work@example.com",
  "secondaryPhone": null,
  "priority": "high"
}
```

**Response `201`:** `Lead`

```json
{
  "id": "ld_...",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+44 7700 900123",
  "secondaryEmail": "jane.work@example.com",
  "secondaryPhone": null,
  "priority": "high",
  "createdAt": "2026-08-19T05:40:00.000Z",
  "updatedAt": "2026-08-19T05:40:00.000Z"
}
```

Email is stored lowercased. Empty `secondaryEmail` / `secondaryPhone` / `priority` are stored as `null`.

**Errors**

- `400` invalid email / missing required fields

---

### `GET /admin/leads`

**Query:** `AdminListQuery`

Soft-deleted leads are excluded.

**Response `200`:** `AdminListResponse<LeadListItem>`

```json
{
  "data": [
    {
      "id": "ld_...",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "phone": "+44 7700 900123",
      "secondaryEmail": "jane.work@example.com",
      "secondaryPhone": null,
      "priority": "high",
      "latestStatus": "contacted",
      "totalNoteCount": 3,
      "lastNote": "Called, no answer",
      "lastNoteCreatedAt": "2026-08-19T06:10:00.000Z",
      "createdAt": "2026-08-19T05:40:00.000Z",
      "updatedAt": "2026-08-19T05:40:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1,
  "totalPages": 1
}
```

A new lead with no pipeline and no notes:

```ts
{
  latestStatus: null,
  totalNoteCount: 0,
  lastNote: null,
  lastNoteCreatedAt: null
}
```

---

### `GET /admin/leads/status`

Dashboard counters. Soft-deleted leads are excluded. Register this path as-is (not under `:id`).

**Response `200`:** `LeadStatusCounts`

```json
{
  "total": 42,
  "highPriority": 8,
  "todayCount": 3,
  "weekCount": 11,
  "monthCount": 27
}
```

| Field | Meaning |
|---|---|
| `total` | Active leads |
| `highPriority` | Active leads whose `priority` is `"high"` (case-insensitive) |
| `todayCount` | Created since start of today (`date_trunc('day', now())`) |
| `weekCount` | Created in the last 7 days |
| `monthCount` | Created in the last 30 days |

Today/week/month overlap (today is included in week and month).

---

### `GET /admin/leads/:id`

**Response `200`:** `LeadDetail`

```json
{
  "id": "ld_...",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+44 7700 900123",
  "secondaryEmail": "jane.work@example.com",
  "secondaryPhone": null,
  "priority": "high",
  "createdAt": "2026-08-19T05:40:00.000Z",
  "updatedAt": "2026-08-19T05:40:00.000Z",
  "pipelines": [
    {
      "id": "pl_...",
      "status": "new",
      "createdAt": "2026-08-19T05:41:00.000Z",
      "updatedAt": "2026-08-19T05:41:00.000Z"
    },
    {
      "id": "pl_...",
      "status": "contacted",
      "createdAt": "2026-08-19T06:00:00.000Z",
      "updatedAt": "2026-08-19T06:00:00.000Z"
    }
  ],
  "notes": [
    {
      "id": "nt_...",
      "note": "Intro email sent",
      "notedBy": "admin",
      "createdAt": "2026-08-19T05:45:00.000Z",
      "updatedAt": "2026-08-19T05:45:00.000Z"
    }
  ]
}
```

`pipelines` and `notes` are always arrays (possibly empty), ordered oldest → newest. Latest status = last item in `pipelines`.

**404** `{ "error": "Lead not found" }` (unknown id or soft-deleted)

---

### `PATCH /admin/leads/:id`

Edit contact fields and/or priority. Send only fields that change. At least one field is required.

**Request**

```ts
type UpdateLeadRequest = {
  name?: string; // min 1 if sent
  email?: string; // valid email if sent
  phone?: string; // min 1 if sent
  secondaryEmail?: string | null; // "" or null clears
  secondaryPhone?: string | null; // "" or null clears
  priority?: string | null; // "" or null clears; any string otherwise
};
```

Example:

```json
{
  "phone": "+44 7700 900999",
  "priority": "medium"
}
```

**Response `200`:** `Lead` (full updated lead, no pipelines/notes)

**Errors**

- `400` `{ "error": "At least one field is required" }` (or Zod field errors)
- `404` `{ "error": "Lead not found" }`

---

### `DELETE /admin/leads/:id`

Soft delete. Sets `is_deleted = true`. The lead disappears from list, detail, and status counts. Notes and pipeline rows stay in the DB but are unreachable through these APIs.

**Response `200`**

```ts
type DeleteLeadResponse = {
  message: "Lead deleted.";
};
```

**404** `{ "error": "Lead not found" }` if already deleted or unknown id.

---

## Pipeline

Cookie required. Each call **appends** a row; it does not overwrite the previous status.

### `POST /admin/pipeline`

**Request**

```ts
type CreatePipelineRequest = {
  leadId: string; // existing (not deleted) lead id
  status: string; // any non-empty string from the frontend
};
```

Example:

```json
{
  "leadId": "ld_...",
  "status": "contacted"
}
```

**Response `201`:** `PipelineItem`

```json
{
  "id": "pl_...",
  "status": "contacted",
  "createdAt": "2026-08-19T06:00:00.000Z",
  "updatedAt": "2026-08-19T06:00:00.000Z"
}
```

**Errors**

- `400` missing / empty `leadId` or `status`
- `404` `{ "error": "Lead not found" }`

After a successful post, list `latestStatus` and detail `pipelines` both reflect the new row.

---

## Notes

Cookie required.

### `POST /admin/notes`

**Request**

```ts
type CreateNoteRequest = {
  leadId: string;
  note: string; // min 1
  notedBy: string; // min 1, who wrote the note
};
```

Example:

```json
{
  "leadId": "ld_...",
  "note": "Called, no answer",
  "notedBy": "admin"
}
```

**Response `201`:** `NoteItem`

```json
{
  "id": "nt_...",
  "note": "Called, no answer",
  "notedBy": "admin",
  "createdAt": "2026-08-19T06:10:00.000Z",
  "updatedAt": "2026-08-19T06:10:00.000Z"
}
```

**Errors**

- `400` missing / empty fields
- `404` `{ "error": "Lead not found" }`

---

### `PATCH /admin/notes/:id`

**Request** — at least one field required

```ts
type UpdateNoteRequest = {
  note?: string; // min 1 if sent
  notedBy?: string; // min 1 if sent
};
```

Example:

```json
{
  "note": "Called back, booked a call"
}
```

**Response `200`:** `NoteItem` (full updated note)

**Errors**

- `400` `{ "error": "At least one of note or notedBy is required" }` (or Zod field errors)
- `404` `{ "error": "Note not found" }`

---

## Suggested UI mapping

| Screen | Endpoints |
|---|---|
| Dashboard counters | `GET /admin/leads/status` |
| Leads table | `GET /admin/leads` |
| Create lead form | `POST /admin/leads` |
| Lead detail | `GET /admin/leads/:id` |
| Edit lead | `PATCH /admin/leads/:id` |
| Delete lead | `DELETE /admin/leads/:id` then leave detail / refresh list |
| Change pipeline status | `POST /admin/pipeline` then refresh list/detail |
| Add note | `POST /admin/notes` then refresh list/detail |
| Edit note | `PATCH /admin/notes/:id` then refresh detail |

Table columns from `LeadListItem`: name, email, phone, secondary email/phone, `priority`, `latestStatus`, `totalNoteCount`, `lastNote`, `lastNoteCreatedAt`.

Table controls (same as other admin lists):

- search name → `name`
- search email → `email`
- sort updated date → `order=asc` or `order=desc`
- pagination → `page` + `limit`; render `total` / `totalPages` from the response

Typical detail flow:

1. `GET /admin/leads/:id`
2. Render contact fields (including `priority`), timeline from `pipelines`, thread from `notes`
3. Edit fields → `PATCH /admin/leads/:id` → replace the lead fields from the `200` body
4. Status change → `POST /admin/pipeline` → refetch detail (or append the `201` body to `pipelines` and treat it as latest)
5. New note → `POST /admin/notes` → refetch (or append the `201` body to `notes`)
6. Delete → `DELETE /admin/leads/:id` → redirect to the list
