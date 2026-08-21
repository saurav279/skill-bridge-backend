# Installment enhancement

Cookie-auth is unchanged (`credentials: "include"`, `admin_token`). This file covers **only APIs that changed or were added** after `installments.md`. Unchanged installment/plan endpoints still match that doc.

Admin flow:

1. `POST /admin/users` (or pick an existing user from `GET /admin/users`)
2. `POST /admin/payment_plans` with that `userId`

JSON uses camelCase `userId` (the DB column is `user_id`).

IDs: user `usr_...`, plan `pln_...`, installment `in_...`, lead `ld_...` (optional on the user).

---

## Route map (new / changed)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/admin/users` | Create a user |
| `GET` | `/admin/users` | Paginated user list |
| `GET` | `/admin/users/:id` | User detail |
| `PATCH` | `/admin/users/:id` | Edit a user |
| `POST` | `/admin/payment_plans` | Create a plan — **now requires `userId` only** |

`PATCH /admin/users` is `PATCH /admin/users/:id` (same pattern as leads).

---

## Shared list query (users)

Same pagination/filter shape as leads.

```ts
export type AdminListQuery = {
  page?: number; // default 1, min 1
  limit?: number; // default 20, min 1, max 100
  name?: string; // ILIKE on user name
  email?: string; // ILIKE on user email
  order?: "asc" | "desc"; // updated_at, default "desc"
  from?: string; // user createdAt
  to?: string;
  leadId?: string; // exact users.lead_id
};

export type AdminListResponse<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
```

Example:

```
GET /admin/users?page=1&limit=20&name=Jane&email=jane@&order=desc
```

`name` and `email` are optional and combined with AND.

| Status | When |
|---|---|
| `400` | Validation failed. `{ error: string }` |
| `401` | Missing/invalid admin cookie |
| `404` | User, lead, or plan not found |
| `500` | Server error |

---

## Users

Cookie required.

```ts
export type User = {
  id: string; // usr_...
  name: string;
  email: string;
  phone: string | null;
  leadId: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};
```

---

### `POST /admin/users`

**Request**

```ts
type CreateUserRequest = {
  name: string; // required, min 1
  email: string; // required, valid email, stored lowercased
  phone?: string | null; // "" or null → stored as null
  leadId?: string | null; // optional existing lead; "" or null → stored as null
};
```

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+44 7700 900123",
  "leadId": "ld_..."
}
```

Without a lead:

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": null,
  "leadId": null
}
```

**Response `201`:** `User`

```json
{
  "id": "usr_...",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+44 7700 900123",
  "leadId": "ld_...",
  "createdAt": "2026-08-20T12:00:00.000Z",
  "updatedAt": "2026-08-20T12:00:00.000Z"
}
```

**Errors**

- `400` `{ "error": "Email already in use" }`
- `400` invalid email / missing `name`
- `404` `{ "error": "Lead not found" }` if `leadId` is set and unknown

---

### `GET /admin/users`

**Query:** `AdminListQuery` (see above)

**Response `200`:** `AdminListResponse<User>`

```json
{
  "data": [
    {
      "id": "usr_...",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "phone": "+44 7700 900123",
      "leadId": "ld_...",
      "createdAt": "2026-08-20T12:00:00.000Z",
      "updatedAt": "2026-08-20T12:00:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1,
  "totalPages": 1
}
```

---

### `GET /admin/users/:id`

**Response `200`:** `User`

**404** `{ "error": "User not found" }`

---

### `PATCH /admin/users/:id`

Send only fields that change. At least one field is required.

**Request**

```ts
type UpdateUserRequest = {
  name?: string; // min 1 if sent
  email?: string; // valid email if sent, stored lowercased
  phone?: string | null; // "" or null clears
  leadId?: string | null; // "" or null clears; otherwise existing lead id
};
```

```json
{
  "phone": "+44 7700 900999",
  "leadId": "ld_..."
}
```

Clear the lead link:

```json
{
  "leadId": null
}
```

**Response `200`:** `User` (full updated user)

**Errors**

- `400` `{ "error": "At least one field is required" }`
- `400` `{ "error": "Email already in use" }`
- `404` `{ "error": "User not found" }`
- `404` `{ "error": "Lead not found" }` if `leadId` is a non-empty unknown id

---

## Payment plans (changed create)

### `POST /admin/payment_plans`

Do **not** send `customerName`, `customerEmail`, `customerPhone`, or `leadId`. Create or select a user first, then send `userId`.

**Request**

```ts
type CreatePaymentPlanRequest = {
  userId: string; // required, existing usr_...
  packageName:
    | "strategy-call"
    | "leadership-enhancement"
    | "diy-membership"
    | "review-only"
    | "full-review"
    | "strategy-session"
    | "bespoke-coaching"
    | "appeal-diagnosis"
    | "appeal-rebuild"
    | "appeal-full-support";
  totalAmount: number; // pence, integer > 0
  currency?: "gbp"; // default "gbp"
  installmentCount?: number; // default 4, min 2, max 24
  intervalDays?: number; // default 60, min 1, max 365
  firstDueAt: string; // YYYY-MM-DD
  installments?: Array<{
    amount: number; // pence
    dueAt: string; // YYYY-MM-DD
  }>;
};
```

If `installments` is omitted, amounts split evenly (remainder on the last row) and due dates start at `firstDueAt`, then every `intervalDays`.

If `installments` is sent, length must equal `installmentCount` and amounts must sum to `totalAmount`.

```json
{
  "userId": "usr_...",
  "packageName": "bespoke-coaching",
  "totalAmount": 600000,
  "installmentCount": 4,
  "intervalDays": 60,
  "firstDueAt": "2026-08-20"
}
```

Custom split:

```json
{
  "userId": "usr_...",
  "packageName": "bespoke-coaching",
  "totalAmount": 600000,
  "installmentCount": 4,
  "firstDueAt": "2026-08-20",
  "installments": [
    { "amount": 150000, "dueAt": "2026-08-20" },
    { "amount": 150000, "dueAt": "2026-10-20" },
    { "amount": 150000, "dueAt": "2026-12-20" },
    { "amount": 150000, "dueAt": "2027-02-20" }
  ]
}
```

**Response `201`:** `PaymentPlanDetail` (same shape as `installments.md`, including joined user fields)

```json
{
  "id": "pln_...",
  "userId": "usr_...",
  "leadId": "ld_...",
  "customerName": "Jane Doe",
  "customerEmail": "jane@example.com",
  "customerPhone": "+44 7700 900123",
  "packageName": "bespoke-coaching",
  "totalAmount": 600000,
  "paidAmount": 0,
  "remainingAmount": 600000,
  "currency": "gbp",
  "installmentCount": 4,
  "paidCount": 0,
  "intervalDays": 60,
  "firstDueAt": "2026-08-20",
  "nextDueAt": "2026-08-20",
  "status": "on_track",
  "createdAt": "2026-08-20T12:05:00.000Z",
  "updatedAt": "2026-08-20T12:05:00.000Z",
  "installments": [
    {
      "id": "in_...",
      "planId": "pln_...",
      "userId": "usr_...",
      "leadId": "ld_...",
      "sequence": 1,
      "installmentCount": 4,
      "amount": 150000,
      "currency": "gbp",
      "dueAt": "2026-08-20",
      "status": "due",
      "checkoutUrl": null,
      "checkoutExpiresAt": null,
      "linkSentAt": null,
      "paidAt": null,
      "failedAt": null,
      "paidOffline": false,
      "stripeSessionId": null,
      "stripePaymentIntentId": null,
      "customerName": "Jane Doe",
      "customerEmail": "jane@example.com",
      "customerPhone": "+44 7700 900123",
      "packageName": "bespoke-coaching",
      "totalAmount": 600000,
      "paidAmount": 0,
      "createdAt": "2026-08-20T12:05:00.000Z",
      "updatedAt": "2026-08-20T12:05:00.000Z"
    }
  ]
}
```

`customerName` / `customerEmail` / `customerPhone` / `leadId` on the response still come from the **user** row. They are not accepted on this request.

If the user has a `leadId`, a system note is added on that lead.

**Errors**

- `400` missing `userId` / invalid package / amount / dates
- `400` `{ "error": "installments length must match installmentCount" }`
- `400` `{ "error": "installment amounts must sum to totalAmount" }`
- `404` `{ "error": "User not found" }`

---

## Suggested UI

| Screen | Endpoints |
|---|---|
| Users table | `GET /admin/users` |
| Create user | `POST /admin/users` |
| Edit user | `PATCH /admin/users/:id` |
| Create payment plan | pick `userId` from users, then `POST /admin/payment_plans` |

Typical flow:

1. `POST /admin/users` → keep `id`
2. `POST /admin/payment_plans` `{ "userId": "<that id>", "packageName": "...", "totalAmount": 600000, "firstDueAt": "2026-08-20" }`
3. Use the `201` `installments` array to send checkout links later (`POST /admin/installments/:id/email` — unchanged)
