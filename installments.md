# Frontend Installments API

Base URL: `http://localhost:3001` (or the deployed API origin).  
CORS origin is `FRONTEND_URL` (default `http://localhost:3000`) with `credentials: true`. Allowed methods: `GET`, `POST`, `PATCH`, `DELETE`, `OPTIONS`.

Every request below **must** use `credentials: "include"` so the `admin_token` cookie is sent. Auth is the same as [frontendAdminDashboard.md](./frontendAdminDashboard.md): login → OTP → cookie. Missing/invalid cookie → `401` `{ "error": "Unauthorized" }`.

A **user** (`usr_...`) holds name, email, phone, and optional `leadId`. A **payment plan** belongs to that user via `userId` only — plans and installments do not store name, email, or lead id. Contact fields in JSON are joined from the user row.

A **payment plan** is one client deal (one package, one total). An **installment** is one scheduled payment inside that plan (default 4 payments, every 2 months). Checkout links are created per installment when you are ready to send them — do not generate all four on day one; Stripe Checkout URLs expire in about 24 hours.

Paid / failed is updated from the existing Stripe webhook (`POST /stripe/webhook`). Do not treat each installment as a new row in `package_purchases`.

---

## Route map

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/admin/payment_plans` | Create a plan + installment schedule |
| `GET` | `/admin/payment_plans` | Paginated plan list |
| `GET` | `/admin/payment_plans/status` | Plan dashboard counts |
| `GET` | `/admin/payment_plans/:id` | Plan detail + all installments |
| `DELETE` | `/admin/payment_plans/:id` | Cancel plan (unpaid installments become `cancelled`) |
| `GET` | `/admin/installments` | Paginated installment list |
| `GET` | `/admin/installments/status` | Installment dashboard counts |
| `GET` | `/admin/installments/:id` | Single installment |
| `POST` | `/admin/installments/:id/checkout` | Create (or reuse) Stripe Checkout URL |
| `POST` | `/admin/installments/:id/email` | Generate link if needed, email the client |
| `PATCH` | `/admin/installments/:id` | Edit amount/due date, or mark paid offline |

Register `/status` routes as-is (not under `:id`).

IDs:

- user: `usr_...`
- payment plan: `pln_...`
- installment: `in_...`
- lead (optional, on the user): `ld_...`

Amounts are **integer minor units** (pence). £1,500.00 → `150000`. Currency is `gbp`.

---

## Shared types

```ts
export type ApiError = {
  error: string;
};

export type AdminListQuery = {
  page?: number; // default 1, min 1
  limit?: number; // default 20, min 1, max 100
  name?: string; // ILIKE on user name
  email?: string; // ILIKE on user email
  order?: "asc" | "desc"; // default "desc"
  packageName?: string; // exact package slug
  from?: string; // ISO date or datetime
  to?: string;
  status?: string; // see status enums below
  leadId?: string; // users.lead_id
  userId?: string; // payment_plans.user_id
  planId?: string; // installments list only
};

export type AdminListResponse<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
```

List query example (same shape as leads):

```
GET /admin/installments?page=1&limit=20&name=Jane&email=jane@&order=desc
GET /admin/installments?status=overdue&from=2026-08-01&to=2026-12-31
GET /admin/payment_plans?packageName=bespoke-coaching&status=on_track
```

`name` and `email` are optional and combined with AND when both are present.

### Error statuses

| Status | When |
|---|---|
| `400` | Validation failed (Zod). `{ error: string }` |
| `401` | Missing cookie, invalid JWT |
| `404` | Plan or installment not found |
| `500` | Server / Stripe / SMTP failure |

---

## Domain types

```ts
export type InstallmentStatus =
  | "upcoming"
  | "due"        // due today or within the next 7 days
  | "link_sent"
  | "paid"
  | "failed"
  | "overdue"    // due date in the past and not paid
  | "cancelled";

export type PaymentPlanStatus =
  | "on_track"
  | "overdue"
  | "complete"
  | "cancelled";

export type Installment = {
  id: string;
  planId: string;
  userId: string;
  leadId: string | null; // from the user row
  sequence: number; // 1-based, e.g. 2
  installmentCount: number; // e.g. 4  →  "2 of 4"
  amount: number; // pence
  currency: string; // "gbp"
  dueAt: string; // YYYY-MM-DD
  status: InstallmentStatus; // computed for the UI
  checkoutUrl: string | null;
  checkoutExpiresAt: string | null; // ISO
  linkSentAt: string | null;
  paidAt: string | null;
  failedAt: string | null;
  paidOffline: boolean;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  customerName: string; // from the user row
  customerEmail: string;
  customerPhone: string | null;
  packageName: string;
  totalAmount: number; // plan total, pence
  paidAmount: number; // sum of paid installments on the plan, pence
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

export type PaymentPlanListItem = {
  id: string;
  userId: string;
  leadId: string | null; // from the user row
  customerName: string; // from the user row
  customerEmail: string;
  customerPhone: string | null;
  packageName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  currency: string;
  installmentCount: number;
  paidCount: number;
  intervalDays: number;
  firstDueAt: string; // YYYY-MM-DD
  nextDueAt: string | null; // YYYY-MM-DD of the next unpaid installment
  status: PaymentPlanStatus;
  createdAt: string;
  updatedAt: string;
};

export type PaymentPlanDetail = PaymentPlanListItem & {
  installments: Installment[]; // sequence 1 → N
};

export type PaymentPlanStatusCounts = {
  total: number;
  onTrack: number;
  overdue: number;
  complete: number;
  cancelled: number;
};

export type InstallmentStatusCounts = {
  total: number; // excludes cancelled
  upcoming: number;
  due: number;
  linkSent: number;
  paid: number;
  failed: number;
  overdue: number;
};
```

`status` on installments is computed, not stored as-is:

1. `paid` if paid (Stripe or offline)
2. `cancelled` if the plan was cancelled
3. `overdue` if `dueAt` is before today and not paid
4. `failed` if the last Stripe attempt failed
5. `link_sent` if a checkout URL was generated
6. `due` if due today or within 7 days
7. otherwise `upcoming`

If a link was sent but the due date has passed, the API returns `overdue` and still includes `checkoutUrl` when present.

---

## Payment plans

Cookie required.

### `POST /admin/payment_plans`

Creates the plan and all installment rows. **Does not** create Stripe links.

**Request**

```ts
type CreatePaymentPlanRequest = {
  leadId?: string; // existing lead; 404 if missing
  customerName?: string; // required if leadId is omitted
  customerEmail?: string; // required if leadId is omitted
  customerPhone?: string | null;
  packageName: // same slugs as packages, e.g. "bespoke-coaching"
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

If `leadId` is sent, name / email / phone default from that lead. Body fields override. The API **find-or-creates a `users` row** by email and stores only `userId` on the payment plan. If that email already has a user, the existing user is reused (and `leadId` is set if it was empty).

If `installments` is omitted, amounts are split evenly (remainder on the last row) and due dates are `firstDueAt`, then every `intervalDays`.

If `installments` is sent, length must equal `installmentCount` and amounts must sum to `totalAmount`.

Example (auto-split):

```json
{
  "leadId": "ld_...",
  "packageName": "bespoke-coaching",
  "totalAmount": 600000,
  "installmentCount": 4,
  "intervalDays": 60,
  "firstDueAt": "2026-08-20"
}
```

Example (custom amounts):

```json
{
  "customerName": "Jane Doe",
  "customerEmail": "jane@example.com",
  "customerPhone": "+44 7700 900123",
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

**Response `201`:** `PaymentPlanDetail`

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
  "createdAt": "2026-08-20T11:00:00.000Z",
  "updatedAt": "2026-08-20T11:00:00.000Z",
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
      "createdAt": "2026-08-20T11:00:00.000Z",
      "updatedAt": "2026-08-20T11:00:00.000Z"
    }
  ]
}
```

If the plan is linked to a lead, a system note is added on that lead.

**Errors**

- `400` `{ "error": "leadId or both customerName and customerEmail are required" }`
- `400` installment split / date validation
- `404` `{ "error": "Lead not found" }`

---

### `GET /admin/payment_plans`

**Query:** `AdminListQuery`

| Query | Filters |
|---|---|
| `name` | user name ILIKE |
| `email` | user email ILIKE |
| `packageName` | exact package slug |
| `from` / `to` | plan `createdAt` |
| `status` | `on_track` \| `overdue` \| `complete` \| `cancelled` |
| `leadId` | user `leadId` |
| `userId` | exact user id |
| `order` | `updated_at` |

`planId` is ignored on this endpoint.

**Response `200`:** `AdminListResponse<PaymentPlanListItem>`

```json
{
  "data": [
    {
      "id": "pln_...",
      "userId": "usr_...",
      "leadId": "ld_...",
      "customerName": "Jane Doe",
      "customerEmail": "jane@example.com",
      "customerPhone": "+44 7700 900123",
      "packageName": "bespoke-coaching",
      "totalAmount": 600000,
      "paidAmount": 150000,
      "remainingAmount": 450000,
      "currency": "gbp",
      "installmentCount": 4,
      "paidCount": 1,
      "intervalDays": 60,
      "firstDueAt": "2026-08-20",
      "nextDueAt": "2026-10-20",
      "status": "on_track",
      "createdAt": "2026-08-20T11:00:00.000Z",
      "updatedAt": "2026-08-21T09:00:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1,
  "totalPages": 1
}
```

---

### `GET /admin/payment_plans/status`

**Response `200`:** `PaymentPlanStatusCounts`

```json
{
  "total": 12,
  "onTrack": 7,
  "overdue": 2,
  "complete": 2,
  "cancelled": 1
}
```

`onTrack` + `overdue` + `complete` + `cancelled` = `total`.

---

### `GET /admin/payment_plans/:id`

**Response `200`:** `PaymentPlanDetail` (plan fields + `installments` array, oldest sequence first)

**404** `{ "error": "Payment plan not found" }`

---

### `DELETE /admin/payment_plans/:id`

Cancels the plan. Unpaid installments become `cancelled`. Already-paid installments stay `paid`.

**Response `200`:** `PaymentPlanDetail` (status `cancelled`)

**Errors**

- `400` `{ "error": "Payment plan is already cancelled" }`
- `404` `{ "error": "Payment plan not found" }`

---

## Installments

Cookie required.

### `GET /admin/installments`

**Query:** `AdminListQuery`

| Query | Filters |
|---|---|
| `name` | user name ILIKE |
| `email` | user email ILIKE |
| `packageName` | exact package slug |
| `from` / `to` | installment **due date** (`dueAt`) |
| `status` | `upcoming` \| `due` \| `link_sent` \| `paid` \| `failed` \| `overdue` \| `cancelled` |
| `leadId` | user `leadId` |
| `userId` | exact user id |
| `planId` | exact payment plan id |
| `order` | `due_at`, then `sequence` |

**Response `200`:** `AdminListResponse<Installment>`

```json
{
  "data": [
    {
      "id": "in_...",
      "planId": "pln_...",
      "userId": "usr_...",
      "leadId": "ld_...",
      "sequence": 2,
      "installmentCount": 4,
      "amount": 150000,
      "currency": "gbp",
      "dueAt": "2026-10-20",
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
      "paidAmount": 150000,
      "createdAt": "2026-08-20T11:00:00.000Z",
      "updatedAt": "2026-08-20T11:00:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1,
  "totalPages": 1
}
```

Table columns from `Installment`: customer name/email, package, `sequence` / `installmentCount`, `amount`, `dueAt`, `status`, `paidAmount` / `totalAmount`.

---

### `GET /admin/installments/status`

Dashboard counters. Cancelled installments are excluded from `total` and from every bucket.

**Response `200`:** `InstallmentStatusCounts`

```json
{
  "total": 40,
  "upcoming": 18,
  "due": 4,
  "linkSent": 3,
  "paid": 10,
  "failed": 1,
  "overdue": 4
}
```

---

### `GET /admin/installments/:id`

**Response `200`:** `Installment`

**404** `{ "error": "Installment not found" }`

---

### `POST /admin/installments/:id/checkout`

Creates a Stripe Checkout Session for **this installment amount only**. If a non-expired URL already exists, it is reused.

**Request** (all optional)

```ts
type CreateInstallmentCheckoutRequest = {
  successUrl?: string; // default FRONTEND_URL/installments/success?session_id={CHECKOUT_SESSION_ID}
  cancelUrl?: string; // default FRONTEND_URL/installments/cancel
};
```

```json
{
  "successUrl": "https://app.example.com/installments/success?session_id={CHECKOUT_SESSION_ID}",
  "cancelUrl": "https://app.example.com/installments/cancel"
}
```

**Response `200`:** `Installment` with `checkoutUrl`, `checkoutExpiresAt`, `stripeSessionId`, and `status` typically `link_sent` (or `overdue` / `due` if the due date drives computed status).

Copy `checkoutUrl` into email, WhatsApp, or a “Pay now” button.

**Errors**

- `400` `{ "error": "Installment is already paid" }`
- `400` `{ "error": "Installment is cancelled" }`
- `400` `{ "error": "Payment plan is cancelled" }`
- `404` `{ "error": "Installment not found" }`

The Checkout URL expires in about **24 hours**. Call this again to mint a new one.

---

### `POST /admin/installments/:id/email`

Creates/reuses a checkout URL, emails the client, and sets `linkSentAt`. If the plan is linked to a lead, a system note is added.

**Request:** same optional `successUrl` / `cancelUrl` as checkout.

**Response `200`**

```json
{
  "message": "Installment email sent.",
  "installment": {
    "id": "in_...",
    "sequence": 2,
    "installmentCount": 4,
    "status": "link_sent",
    "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_...",
    "linkSentAt": "2026-10-13T09:00:00.000Z"
  }
}
```

(`installment` is the full `Installment` object.)

**Errors** — same as checkout, plus `500` if SMTP is not configured.

---

### `PATCH /admin/installments/:id`

Send only fields that change. At least one field is required.

**Request**

```ts
type UpdateInstallmentRequest = {
  amount?: number; // pence, only if not paid
  dueAt?: string; // YYYY-MM-DD, only if not paid
  paidOffline?: boolean; // true → mark paid without Stripe
};
```

Change due date:

```json
{
  "dueAt": "2026-11-01"
}
```

Mark a bank transfer as paid:

```json
{
  "paidOffline": true
}
```

Changing `amount` also refreshes the plan `totalAmount` to the sum of all installments.

**Response `200`:** `Installment`

**Errors**

- `400` `{ "error": "At least one field is required" }`
- `400` `{ "error": "Paid installments cannot be edited" }`
- `400` `{ "error": "Installment is already paid" }` (when `paidOffline` is sent on a paid row)
- `400` `{ "error": "Installment is cancelled" }`
- `404` `{ "error": "Installment not found" }`

---

## Stripe webhook (no frontend call)

The existing `POST /stripe/webhook` endpoint:

- `checkout.session.completed` → installment `paid`, `paidAt` set, lead note if linked
- `payment_intent.payment_failed` → installment `failed`, `failedAt` set, lead note if linked

The admin UI should refetch the installment or plan after the client returns from Checkout. Do not mark paid from the success page alone.

---

## Suggested UI mapping

| Screen | Endpoints |
|---|---|
| Due / overdue counters | `GET /admin/installments/status` |
| Installments table | `GET /admin/installments` |
| Plans table | `GET /admin/payment_plans` |
| Create plan (from lead or standalone) | `POST /admin/payment_plans` |
| Plan detail (timeline of 4) | `GET /admin/payment_plans/:id` |
| Generate / copy link | `POST /admin/installments/:id/checkout` then use `checkoutUrl` |
| Email client | `POST /admin/installments/:id/email` |
| Mark bank transfer paid | `PATCH /admin/installments/:id` `{ "paidOffline": true }` |
| Cancel remaining payments | `DELETE /admin/payment_plans/:id` |
| Lead timeline | existing notes; system notes appear after create / send / pay / fail |

Typical create → collect flow:

1. From a lead, `POST /admin/payment_plans` with `leadId`, `packageName`, `totalAmount`, `firstDueAt`
2. Show the four `installments` from the `201` body
3. When installment 1 is due: `POST /admin/installments/:id/email` (or checkout + copy link)
4. Poll / refetch `GET /admin/payment_plans/:id` after they pay (webhook marks `paid`)
5. Repeat for installments 2–4 every two months

Table controls (same as leads):

- search name → `name`
- search email → `email`
- status filter → `status`
- date range → `from` + `to` (due date on installments, created date on plans)
- sort → `order=asc` or `order=desc`
- pagination → `page` + `limit`; render `total` / `totalPages` from the response
