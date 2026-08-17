# Frontend Admin Dashboard API

Base URL: `http://localhost:3001` (or the deployed API origin).  
CORS origin is `FRONTEND_URL` (default `http://localhost:3000`) with `credentials: true`.

Every admin request from the browser **must** use `credentials: "include"` so the `admin_token` cookie is sent. Do not store or send the JWT in `localStorage` or an `Authorization` header — the backend only reads the cookie.

---

## Auth flow

Two-factor login. The JWT is set only after OTP succeeds.

```
1. Login form  →  POST /admin/login  { email, password }
2. Backend emails a 6-digit OTP to admin@skillbridgeconsultants.com
3. OTP form    →  POST /admin/otp    { email, otp }
4. Backend sets httpOnly cookie admin_token  (7 days)
5. Dashboard   →  GET /admin/...     with credentials: "include"
6. 401         →  treat as logged out, send user back to login
```

OTP expires in **10 minutes**. After **5** failed attempts the code is invalidated and the admin must login again.

There is no logout endpoint. To clear the session on the client, expire/overwrite the cookie from the API later, or just send the user to login; a missing/invalid cookie is `401`.

### Example fetch helper

```ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? "Request failed");
  }
  return json as T;
}
```

---

## Cookie setting

Set by `POST /admin/otp` via `Set-Cookie`. The frontend cannot read it (`HttpOnly`).

| Attribute | Value |
|---|---|
| Name | `admin_token` |
| Value | JWT (`sub: "admin"`, `email`, `exp`) |
| `HttpOnly` | `true` |
| `Path` | `/` |
| `Max-Age` | `604800` (7 days) |
| `Secure` | `true` in production, and when `FRONTEND_URL` contains `localhost` |
| `SameSite` | `None` in production / localhost (cross-origin: `:3000` → `:3001`); otherwise `Lax` |

Protected routes read `req.cookies.admin_token` only. Missing, empty, or invalid JWT → **401** `{ "error": "Unauthorized" }`.

Frontend requirements:

- `fetch(..., { credentials: "include" })` (or axios `withCredentials: true`)
- Do not set `Access-Control-Allow-Origin: *` on a proxy; origin must be exact
- Next.js: if you proxy `/admin` through the same origin, cookies still work; if you call the API origin directly, `SameSite=None; Secure` is required (already set for localhost)

---

## Shared types

```ts
export type ApiError = {
  error: string;
};

export type AdminListQuery = {
  page?: number; // default 1, min 1
  limit?: number; // default 20, min 1, max 100
  name?: string; // ILIKE search
  email?: string; // ILIKE search
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
GET /admin/assessments?page=1&limit=20&name=Jane&email=jane@&order=desc
```

`name` and `email` are optional and combined with AND when both are present.

### Error statuses

| Status | When |
|---|---|
| 400 | Validation failed (Zod). `{ error: string }` |
| 401 | Bad login, bad/expired OTP, missing cookie, invalid JWT |
| 404 | Record not found |
| 500 | Server / SMTP failure |

---

## Auth endpoints

### `POST /admin/login`

Public. Does **not** set a cookie.

**Request**

```ts
type AdminLoginRequest = {
  email: string;
  password: string;
};
```

**Response `200`**

```ts
type AdminLoginResponse = {
  message: "OTP sent";
};
```

**Errors**

- `401` `{ "error": "Invalid email or password" }`
- `400` `{ "error": "Admin login is not configured." }` if env is missing

OTP is always sent to `admin@skillbridgeconsultants.com`, not to the login email in the request body.

---

### `POST /admin/otp`

Public. Sets `admin_token` on success.

**Request**

```ts
type AdminOtpRequest = {
  email: string; // same email used at login
  otp: string; // exactly 6 digits, e.g. "482193"
};
```

**Response `200`**

```ts
type AdminOtpResponse = {
  message: "Logged in";
};
```

The JWT is **not** in the JSON body. It is only on the `Set-Cookie: admin_token=...` header.

**Errors**

- `401` `{ "error": "Invalid or expired OTP" }`
- `400` if `otp` is not 6 digits

---

## Assessments

Cookie required.

### `GET /admin/assessments`

**Query:** `AdminListQuery`  
Name matches `contactName`. Email matches `contactEmail`.

**Response `200`:** `AdminListResponse<AdminAssessmentListItem>`

```ts
type AdminAssessmentListItem = {
  id: string;
  routeId: string;
  contactName: string | null;
  contactEmail: string | null;
  phone: string | null;
  resumeLink: string | null;
  confidenceScore: number;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};
```

---

### `GET /admin/assessments/:id`

**Response `200`:** `AdminAssessmentDetail`

```ts
type RouteId = "digital-technology" | "academia" | "arts";

type AssessSectionAnswers = Record<string, string | string[]>;

type AssessPayload = {
  routeId: RouteId;
  resumeLink?: string;
  [sectionId: string]: string | AssessSectionAnswers | undefined;
};

type AssessmentReport = {
  id: string;
  routeId: string;
  customerName?: string;
  customerEmail?: string;
  summary: string;
  headline: string;
  confidenceScore: number;
  breakdown: Array<{ id: string; label: string; score: number }>;
  strengths: string[];
  improvements: string[];
  priorityImprovements: Array<{
    id: string;
    priority: "high" | "medium" | "easy";
    title: string;
    description: string;
  }>;
  overallRecommendation: string;
};

type AdminAssessmentDetail = AdminAssessmentListItem & {
  payload: AssessPayload;
  report: AssessmentReport;
};
```

**404** `{ "error": "Assessment not found" }`

---

## Contact messages

Cookie required.

### `GET /admin/contact_messages`

**Query:** `AdminListQuery`  
Name matches `name`. Email matches `email`.

**Response `200`:** `AdminListResponse<AdminContactMessage>`

---

### `GET /admin/contact_messages/:id`

**Response `200`:** `AdminContactMessage`

```ts
type AdminContactMessage = {
  id: string;
  name: string;
  email: string;
  phone: string;
  livesInUk: boolean;
  currentVisa: string | null;
  prefered: "phone" | "google_meet" | string | null;
  subject: string;
  message: string;
  createdAt: string;
  updatedAt: string;
};
```

**404** `{ "error": "Contact message not found" }`

---

## Package purchases

Cookie required.

### `GET /admin/package_purchases`

**Query:** `AdminListQuery`  
Name matches `customerName`. Email matches `customerEmail`.

**Response `200`:** `AdminListResponse<AdminPackagePurchase>`

---

### `GET /admin/package_purchases/:id`

**Response `200`:** `AdminPackagePurchase`

```ts
type AdminPackagePurchase = {
  id: string;
  customerName: string;
  customerEmail: string;
  stripeSessionId: string;
  stripePaymentIntentId: string | null;
  amount: number; // integer, Stripe minor units
  currency: string;
  packageName: string;
  createdAt: string;
  updatedAt: string;
};
```

**404** `{ "error": "Package purchase not found" }`

---

## Suggested UI mapping

| Screen | Endpoint |
|---|---|
| Login | `POST /admin/login` then `POST /admin/otp` |
| Assessments table | `GET /admin/assessments` |
| Assessment detail | `GET /admin/assessments/:id` |
| Contact inbox | `GET /admin/contact_messages` |
| Contact detail | `GET /admin/contact_messages/:id` |
| Purchases table | `GET /admin/package_purchases` |
| Purchase detail | `GET /admin/package_purchases/:id` |

Table controls:

- search name → `name`
- search email → `email`
- sort updated date → `order=asc` or `order=desc`
- pagination → `page` + `limit`; render `total` / `totalPages` from the response
