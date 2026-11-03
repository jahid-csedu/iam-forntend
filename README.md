# IAM System: Frontend Implementation Plan

The frontend team's onboarding guide and build plan for the IAM System, a multi-tenant authentication and
authorization provider similar to Auth0.

| | |
|---|---|
| **Audience** | Frontend developers who have never seen the backend |
| **Backend** | `iam-system` (Spring Boot, REST + JWT), sister folder of this one |
| **Matches backend as of** | Step 11 (client status), the password-reset security fixes, CORS, `GET /api/me`, `PATCH /api/users/{id}`, `PATCH /api/me`, password-guess lockout, 401 reasons, `expires_in`, no self-deletion, environment profiles (2026-10-26), user deactivation and unlock (backend step 12), the email service with asynchronous sending and email verification (backend step 13), RFC 9457 error answers (2026-10-27), Actuator health and info (2026-10-31); the backend plan is complete |
| **Owner of this document** | Product (update it with every backend step, see [section 9](#9-how-this-document-evolves)) |

Read sections 1 to 4 once, front to back. After that, section 6 is the build plan: work through it in order, one numbered
step at a time. Section 7 maps every backend endpoint to the step that uses it, and section 8 lists what the backend
doesn't do yet.

> **Source of truth.** Everything here was checked against the backend code (controllers, DTOs, error handler). Where the
> backend's own `docs/USER_MANUAL.md` and the code disagree, this document follows the code and says so
> (see [8.3](#83-documentation-mismatches-found-while-writing-this-plan)). When in doubt, open Swagger UI at
> `http://localhost:8080/swagger-ui.html` and try the call.

---

## Table of contents

1. [Product overview](#1-product-overview)
   - [1.1 What the IAM does](#11-what-the-iam-does)
   - [1.2 The three levels](#12-the-three-levels)
   - [1.3 Core concepts](#13-core-concepts)
   - [1.4 Glossary](#14-glossary)
   - [1.5 The permission catalog](#15-the-permission-catalog)
   - [1.6 Predefined roles](#16-predefined-roles)
2. [What we build: the two frontend apps](#2-what-we-build-the-two-frontend-apps)
3. [The auth model for the frontend](#3-the-auth-model-for-the-frontend)
   - [3.1 Logging in always needs a `client_id`](#31-logging-in-always-needs-a-client_id)
   - [3.2 How the console finds its `client_id`](#32-how-the-console-finds-its-client_id)
   - [3.3 Tokens and what is inside them](#33-tokens-and-what-is-inside-them)
   - [3.4 Where to keep tokens](#34-where-to-keep-tokens)
   - [3.5 Refreshing: single-flight, across tabs](#35-refreshing-single-flight-across-tabs)
   - [3.6 Logging out and losing a session](#36-logging-out-and-losing-a-session)
   - [3.7 What 400, 401, 403, 404, 422, 429 and 503 mean for the UI](#37-what-400-401-403-404-422-429-and-503-mean-for-the-ui)
   - [3.8 Platform users and `X-Tenant-Id`](#38-platform-users-and-x-tenant-id)
   - [3.9 Deciding what to show: permissions in the UI](#39-deciding-what-to-show-permissions-in-the-ui)
4. [API conventions](#4-api-conventions)
5. [Shared UI rules](#5-shared-ui-rules)
6. [Step-by-step build plan](#6-step-by-step-build-plan)
   - [Phase 0: foundations](#phase-0-foundations) (steps 1-4)
   - [Phase 1: getting in](#phase-1-getting-in) (steps 5-9)
   - [Phase 2: tenant administration](#phase-2-tenant-administration) (steps 10-18)
   - [Phase 3: platform administration](#phase-3-platform-administration) (steps 19-23)
   - [Phase 4: regular users and app developers](#phase-4-regular-users-and-app-developers) (steps 24-25)
   - [Phase 5: waiting on the backend](#phase-5-waiting-on-the-backend) (steps 26-28)
7. [API coverage matrix](#7-api-coverage-matrix)
8. [Backend gaps and planned work](#8-backend-gaps-and-planned-work)
9. [How this document evolves](#9-how-this-document-evolves)

---

## 1. Product overview

### 1.1 What the IAM does

The IAM answers two questions for other software: **"who is this user?"** (authentication) and, for the IAM's own admin
API, **"may this user do that?"** (authorization).

- Companies (**tenants**) sign up and get their own isolated space: their own users, roles and applications.
- A tenant registers its **applications** (we call them **clients**). Its users log in *through* a client and receive a
  signed **access token** (a JWT) and, optionally, a **refresh token**.
- The tenant's applications verify those tokens on their own (with the IAM's public keys) or ask the IAM whether a token
  is still active (introspection). The IAM doesn't decide what users may do inside those applications; it only
  says who they are.
- Administrators manage everything through the IAM's REST API. **Today there is no UI at all: building it is our job.**

### 1.2 The three levels

```
Platform (global)        super users: run the whole service, manage tenants
 └─ Tenant               root user + management users: manage their own tenant only
     └─ Regular users    log in to the tenant's applications, self-service only
```

| Level | Who | What they do | Where they log in |
|---|---|---|---|
| **Platform** | **Super users**, the operators of the IAM service. They live in one special built-in tenant called **Platform**. Its first user, the **platform root**, is created from server config at startup. | List, create, suspend and activate tenants. Step *inside* any tenant (with the `X-Tenant-Id` header) to help or investigate, as far as their **grants** allow (the platform root may do everything). Give other super users grants. | The Platform tenant's management console client |
| **Tenant** | The tenant's **root user** (exactly one, created at signup) and **management users** (created by root or another admin). | Manage the tenant's users, roles, applications (clients) and token settings. | Their tenant's management console client |
| **Regular user** | End users of the tenant's applications. | Log in to the tenant's applications, change their own password, reset a forgotten password, log out. **No admin access ever.** | Any *application* client of their tenant (never the management console) |

### 1.3 Core concepts

**Tenant.** One organization, fully isolated from every other. Anything that belongs to another tenant is invisible:
asking for it gives `404 Not Found`, never `403`. A tenant is `ACTIVE` or `SUSPENDED`; a suspended tenant's users
can't log in or use their tokens. There are two tenant types: `STANDARD` (every customer) and `PLATFORM` (exactly one, the
super users' home).

**Client.** An application of a tenant, identified by a public, random, 24-character **`client_id`** (for example
`<client_id>`; it is not a secret). Every login, token refresh and forgot-password request names a `client_id`, and the
client decides which tenant the user is looked up in. There are two client types:

| Type | Created | Who can log in through it | Can be deleted / suspended |
|---|---|---|---|
| `MANAGEMENT_CONSOLE` | Automatically, one per tenant, at tenant creation | **Management users only** (regular users get `403`) | **Never** |
| `APPLICATION` | By an admin (`POST /api/clients`) | All users of the tenant | Yes |

Each client has its own **token settings**: access-token lifetime, whether refresh tokens are issued and their
lifetime, and which user details (claims) go into the token. A client is `ACTIVE` or `SUSPENDED`.

**User.** Belongs to exactly one tenant. Usernames and emails are unique *per tenant* (two tenants may both have a
`bob`), except root users, whose username and email are unique across *all* tenants. Every user has a **user type**,
chosen at creation and never changed:

| User type | Holds roles / permissions | Logs in through |
|---|---|---|
| `MANAGEMENT` | Yes (roles and/or direct permissions) | The management console and application clients |
| `REGULAR` (default) | **Never** (the API answers `400`) | Application clients only |

The **root user** is a management user with one special property: it holds every tenant permission *implicitly*, not
through a role. Its access can't be edited, it can't be deleted, and nobody else can reset its password.

**Permission.** A fixed key in the form `<resource>:<action>`, such as `users:read`. Nobody can create, change or delete
permissions: they ship with the backend features that need them. Each permission has a **scope**:
`TENANT` (manage things inside a tenant) or `PLATFORM` (`tenants:*`, manage tenants; only meaningful for super users).

**Role.** A named set of permissions owned by one tenant (name unique within the tenant). Roles are fully editable.
A management user's effective permissions are **(permissions of all their roles) ∪ (their direct permissions)**.
Changes apply on the user's very next request; no new login is needed, because the backend reads permissions from its
database on every call (they are never in the token).

**No self-modification.** Nobody can change their own roles or direct permissions, edit or delete a role they hold, or
reset their own password through the admin endpoint. Somebody else with the permission must do it. The UI hides or
disables those actions (section 5).

**Session.** Every successful login starts a session on the server. Access tokens name their session (`sid`), and the
refresh token keeps the session alive. Logout ends the session; so does a password reset; changing your own password
ends all your *other* sessions.

### 1.4 Glossary

| Term | Plain meaning |
|---|---|
| **Access token** | A short-lived signed JWT (default 5 minutes) sent as `Authorization: Bearer <token>` on every protected request. |
| **Refresh token** | A random opaque string (not a JWT) traded for a new access token *and a new refresh token*. Single use. Default lifetime 24 hours. |
| **Rotation** | Every refresh returns a new refresh token and burns the old one. |
| **Reuse detection** | Presenting an already used refresh token again ends the whole session (the server assumes it was stolen). |
| **Session** | One login. Lives as long as its latest refresh token (or, without refresh tokens, its access token). |
| **`client_id`** | Public id of a client application; decides the tenant at login. |
| **Management console** | The built-in client every tenant has; also the name of the web app we build for admins. |
| **Root user** | The single all-powerful user of a tenant, created at signup. |
| **Platform root** | The root user of the Platform tenant: may do everything in every tenant. |
| **Super user / platform user** | Any management user of the Platform tenant. |
| **Grant** | Gives a platform user a platform role or a single permission **on one tenant or on all tenants**. |
| **`X-Tenant-Id`** | Request header a platform user adds to work inside another tenant. Ignored for tenant users. |
| **OTP** | A 6-digit one-time code emailed for password resets. Valid 5 minutes, 5 wrong guesses allowed, max 3 per user per hour. |
| **JWKS** | The public key set (`/.well-known/jwks.json`) applications use to verify access tokens. |
| **Introspection** | `POST /api/auth/introspect`: asks the IAM whether a token is active right now. |
| **Claim** | A field inside a JWT, such as `sub` (user id) or `email`. |

### 1.5 The permission catalog

Ids are database ids: **never hard-code them**. Read the catalog with `GET /api/permissions` and match on `name`.

| Key | Scope | Allows | UI that needs it |
|---|---|---|---|
| `users:read` | TENANT | List users; find them by id, username or email | Users list and detail |
| `users:create` | TENANT | Create **regular** users | "New user" |
| `users:create-management` | TENANT | Create **management** users (on top of `users:create`) | "Management user" option in "New user" |
| `users:update` | TENANT | Assign/remove roles and direct permissions of *other* management users | Access editor on user detail |
| `users:delete` | TENANT | Delete users (never a root user) | "Delete user" |
| `users:reset-password` | TENANT | Send another user a reset OTP; their old password stops working at once | "Reset password" on user detail |
| `users:deactivate` | TENANT | Deactivate other users (never yourself or the root) | "Deactivate" on user detail |
| `users:activate` | TENANT | Reactivate deactivated users | "Activate" on user detail |
| `users:unlock` | TENANT | End another user's login lockout at once (never yourself or the root) | "Unlock" on user detail |
| `roles:read` | TENANT | List roles, find by id or name | Roles pages; role names everywhere |
| `roles:create` | TENANT | Create roles | "New role" |
| `roles:update` | TENANT | Rename, describe, add/remove permissions (never a role you hold) | Role detail editing |
| `roles:delete` | TENANT | Delete roles (never a role you hold) | "Delete role" |
| `clients:read` | TENANT | List and view clients | Applications pages |
| `clients:create` | TENANT | Register application clients | "New application" |
| `clients:update` | TENANT | Rename clients, change token settings | Client detail editing |
| `clients:delete` | TENANT | Delete application clients (never the console) | "Delete application" |
| `clients:suspend` | TENANT | Suspend application clients (never the console) | "Suspend" |
| `clients:activate` | TENANT | Reactivate clients | "Activate" |
| `permissions:read` | TENANT | Read the catalog | Permission pickers, catalog page |
| `tenants:read` | PLATFORM | List and view tenants | Platform tenants list/detail |
| `tenants:create` | PLATFORM | Create tenants (needs a grant on **all** tenants) | "New tenant" |
| `tenants:suspend` | PLATFORM | Suspend a tenant (never Platform) | "Suspend tenant" |
| `tenants:activate` | PLATFORM | Reactivate a tenant | "Activate tenant" |

PLATFORM keys only work through **grants** (section 3.8). A standard tenant's roles can never contain them (the API
answers `404` "Some permissions not found"), so permission pickers in a standard tenant must hide them.

### 1.6 Predefined roles

Every new tenant gets its own copies of these roles. They are ordinary roles afterwards (editable, deletable). A key
added to the backend later reaches an existing tenant's roles only when an admin adds it (the root holds it at once),
so a role in an older tenant may lack a newer key.

| Role | Permissions |
|---|---|
| `ADMIN` | Every TENANT key |
| `USER_MANAGER` | `users:read`, `users:create`, `users:update`, `users:delete`, `users:deactivate`, `users:activate`, `users:unlock` |
| `VIEWER` | `users:read`, `roles:read`, `clients:read`, `permissions:read` |

---

## 2. What we build: the two frontend apps

**Recommendation: build two separate apps from one repository, sharing an API/auth package.**

| App | Users | Purpose | Priority |
|---|---|---|---|
| **A. Management Console** (`apps/console`) | Tenant root + management users; platform super users | Full admin UI over the REST API: users, roles, permissions, applications, token settings, tenants, grants | **P0**: the main product surface. Nothing else administers the IAM today except Swagger. |
| **B. Hosted Auth Pages** (`apps/auth`) | Regular users of a tenant's application clients (and anyone who forgot a password) | Login, forgot password, reset with OTP, a small "my account" page (change password, log out) | **P1**: smaller; most of its components are shared with the console. |

Why two apps, not one:
- **Different audiences and risk.** The console is a rich, permission-heavy admin tool. The auth pages are the public front
  door for end users of many tenants: they must be tiny, fast, accessible, brandable per tenant later, and expose no admin
  code.
- **Different `client_id` sources.** The console always logs in through a *management console* client. The auth pages
  always serve one *application* client, named in the URL.
- **Independent deploys.** Tenants will link to the auth pages from their apps and from emails (planned reset links,
  backend roadmap item 3). They must stay stable while the console evolves quickly.

Why one repository: both apps need the same API client, error handling, token store, password-policy validator and form
components. Put those in `packages/iam-client` (API + auth) and `packages/ui` (shared components).

**An important limit of the auth pages today.** The backend has no OAuth2/OIDC redirect flow yet (no registered redirect
URIs, no authorization code). So a hosted login page **cannot safely hand tokens back to a third-party application** on
another origin. Until the backend adds that (roadmap: OAuth2/OIDC, see section 8), the auth pages do this:
1. **Forgot password and reset with OTP** work fully for any client (no tokens need to be handed over).
2. **Login + "My account"** work fully for the regular user themself (change password, log out) on the auth pages' own
   origin.
3. Application developers log their users in **from their own app** with the same API calls. We publish the
   `packages/iam-client` login/refresh logic so they can reuse it, and document it in the console's integration guide
   (step 25).

When the backend adds redirect URIs and an authorization-code flow, the auth pages' login becomes the universal login
(like Auth0's), with no redesign: only the "after login" behaviour changes.

---

## 3. The auth model for the frontend

### 3.1 Logging in always needs a `client_id`

There is exactly **one** login endpoint for everybody:

```http
POST /api/auth/authenticate
Content-Type: application/json

{ "client_id": "<client_id>", "username": "jane", "password": "Password1!" }
```

```json
200 OK
{
  "access_token": "<JWT>",
  "token_type": "Bearer",
  "expires_in": 300,
  "refresh_token": "<opaque refresh token>",
  "username": "jane"
}
```

- `refresh_token` is **missing** when the client has refresh tokens switched off.
- `expires_in` is the access token's lifetime in seconds (the client's setting, 60 to 3600); it always matches the
  token's `exp`. Use it for the refresh timer (section 3.5) instead of decoding the token. Refresh answers the same way.
- Token responses carry `Cache-Control: no-store`; never cache or log them.
- The username is looked up **only in the tenant of that `client_id`**. The same username in another tenant is a
  different person.

### 3.2 How the console finds its `client_id`

Every tenant has its **own** management console client with its own `client_id`. One deployed console web app serves all
tenants, so it must learn which console `client_id` to use:

| Situation | Where the `client_id` comes from |
|---|---|
| Right after tenant signup | The signup response: `managementConsole.client_id`. The success page shows the tenant's personal console login link. |
| A returning admin | The personal login link `https://<console-host>/login/<console_client_id>` (bookmarked or emailed to new admins). |
| Same browser, later | The console remembers recently used consoles in `localStorage` (just `client_id` + tenant name; never tokens). |
| Typed by hand | The generic `/login` page has a "Console ID" field. |
| Platform super users | The Platform tenant's console `client_id` is printed **once in the server log** when the Platform tenant is first created. Ops puts it in the console's build/runtime config (`VITE_PLATFORM_CONSOLE_CLIENT_ID`), and `/login/platform` uses it. |

After login, keep the `client_id` next to the tokens: every refresh must go through the **same** client.

There is no backend endpoint to look up a tenant's console by tenant name (see gap G-8). Do not invent one.

### 3.3 Tokens and what is inside them

The access token is an RS256-signed JWT. The frontend **decodes** it (base64url-decode the middle part, no verification
needed in the browser; the server verifies it on every call) to read:

| Claim | Meaning | Always present |
|---|---|---|
| `sub` | User id (as a string) | Yes |
| `iss` | `<IAM base URL>/tenants/<tenantId>`: the **last path segment is the user's tenant id** | Yes |
| `aud`, `client_id` | The client the token was issued through | Yes |
| `sid` | Session id | Yes |
| `jti`, `iat`, `exp` | Token id, issued-at, expiry (seconds since epoch) | Yes |
| `username`, `email`, `full_name`, `user_type`, `tenant_id` | Only the claims the client's token settings select (default: `username` only); `email` comes with `email_verified` (`true`/`false`) | No |

Do **not** rely on optional claims: each tenant can change its console's claim list. For identity use `sub` and the
tenant id parsed from `iss`, then load details from the API (section 3.9).

The refresh token is an opaque string. Never parse it.

### 3.4 Where to keep tokens

The backend returns both tokens in the JSON body (no cookies), so they live in browser JavaScript. Recommendation:

| Token | Store | Why |
|---|---|---|
| Access token | **In memory only** (a module-level variable in the auth store) | Short-lived (default 5 min). Never written anywhere persistent. |
| Refresh token | **`localStorage`**, key `iam.session.<client_id>`, value `{ refreshToken, clientId }` | Survives reloads and is shared by tabs, so all tabs use **one** session. Combined with the cross-tab lock in 3.5 this avoids reuse detection killing the session. |

Trade-offs considered:
- *Memory only*: safest against XSS, but every reload logs the user out. Acceptable fallback if security review insists.
- *`sessionStorage`*: survives reload, but a duplicated tab copies the same refresh token into two tabs that refresh
  independently, and the second refresh **revokes the session** (reuse detection). Rejected.
- *httpOnly cookie*: best against XSS, but the backend doesn't support it today (gap G-5).

Because the refresh token is readable by JavaScript, XSS protection is mandatory: strict Content Security Policy, no
`dangerouslySetInnerHTML`, no third-party scripts in the console, dependency audit in CI.

Never log tokens, passwords or OTPs (not in `console.log`, not in error trackers, not in analytics). Scrub them from
Sentry-style breadcrumbs.

### 3.5 Refreshing: single-flight, across tabs

Refresh tokens are **single use**, and reusing an old one **revokes the session**. Two refreshes racing with the same
token (two parallel requests that both got `401`, or two tabs) would log the user out. So:

1. **One refresh at a time per browser.** Wrap the refresh in the Web Locks API
   (`navigator.locks.request('iam-refresh-' + clientId, ...)`). Inside the lock, **re-read** the refresh token from
   `localStorage`: if it differs from the one this tab started with, another tab already refreshed; use the new state
   instead of calling the server.
2. **One refresh at a time per tab.** Keep a single in-flight promise; every caller awaits the same promise.
3. **Share the result.** After a refresh, write the new refresh token to `localStorage` and post the new access token on a
   `BroadcastChannel('iam-auth')` so other tabs don't need to refresh at all.
4. **Proactive refresh.** Schedule a refresh about 30 seconds before the access token expires (`expires_in` seconds after
   the response arrived, or at 80 % of it for very short lifetimes). This avoids most `401`s.
5. **Reactive refresh.** If a protected request still gets `401`, refresh once (single-flight), then retry the original
   request **once**. A second `401` means the session is gone: go to the login screen.

```http
POST /api/auth/token/refresh
{ "client_id": "<client_id>", "refresh_token": "<refresh token>" }
```

```json
200 OK
{ "username": "jane", "refresh_token": "<NEW refresh token>", "access_token": "<NEW JWT>" }
```

| Refresh answer | Meaning | UI |
|---|---|---|
| `200` | New tokens; the old refresh token is now used up | Replace both tokens immediately |
| `400` "This client doesn't issue refresh tokens" | The client has refresh switched off | Don't retry; when the access token expires, send the user to login with "Your session ended, please log in again" |
| `401` | Refresh token unknown, expired, already used, logged out, or issued through another client | Clear the session, go to login ("Your session has ended") |
| `403` | Tenant or client suspended, or the account is locked, disabled or its password expired | Clear the session, go to login and show the server's `message` |

Without refresh tokens (client setting off), the session simply ends when the access token expires. Warn the user a minute
before (`exp` is known) and send them to login afterwards.

### 3.6 Logging out and losing a session

```http
POST /api/auth/logout
Authorization: Bearer <access token>
```
→ `204 No Content`. It ends the session of that access token; its refresh token stops working.

Logout steps in the client:
1. If the access token is expired, refresh first (so the server can end the session); if refresh fails, skip step 2.
2. Call `POST /api/auth/logout`.
3. Whatever the result, delete the access token from memory and the refresh token from `localStorage`, broadcast
   `logout` on the `BroadcastChannel` (all tabs go to login), clear the data cache (TanStack Query `queryClient.clear()`).

The session can also end without the user doing anything: an admin reset their password, someone else changed it
(all other sessions end), their account was deleted, or the tenant or client was suspended. The UI notices this
as a failed refresh or a `401` after refresh (section 3.5) and sends the user to login with a neutral message:
"Your session has ended. Please log in again." Never guess the reason.

### 3.7 What 400, 401, 403, 404, 409, 422, 429 and 503 mean for the UI

| Status | Meaning in this backend | Default UI behaviour |
|---|---|---|
| `400` | Business rule broken or input rejected: password policy, wrong old password, invalid OTP, regular user given roles, console can't be deleted/suspended, malformed `X-Tenant-Id`, malformed body, invalid `page`/`size` | Show `detail` next to the form (or as a toast for button actions). Keep the user's input. |
| `401` | Not authenticated: no/expired/revoked token ("A valid access token is required"), a blocked account ("Your account is locked until <ISO time>", "Your account is deactivated", "Tenant is suspended", "Client is suspended"), wrong username or password, unknown `client_id`, bad refresh token | On protected calls: refresh-and-retry once, then go to login. If the 401's `detail` is one of the blocked-account reasons, don't retry: go to login and show it (format the lock time in local time). On the login form: "Wrong username or password." |
| `403` | Authenticated but not allowed: missing permission; self-modification; resetting root's password; regular user on the console; tenant/client suspended; account locked/disabled/password expired | Show "You don't have permission to do this" (or the specific `detail` where listed in each step). **Do not log the user out.** Refresh the permission view (3.9). |
| `404` | Not found, including anything in another tenant, unknown permission/role ids in a list, unknown `X-Tenant-Id` | On detail pages: a "Not found" page with a link back to the list. In pickers: reload the options. |
| `405` | Method not supported | Bug in our code; report it. |
| `409` | Already exists: a tenant, user, role or client name, a username or email ("Role name already exists", "Email not available", ...) | Show `detail` under the field that clashes. Keep the user's input. |
| `422` | Validation failed; `errors[]` lists `field` + `message` | Map each `errors[].field` to the form field and show its message. |
| `429` | Too many reset OTPs for this user in the last hour (admin reset only) | Toast: "Too many reset emails for this user in the last hour. Try again later." |
| `503` | The reset email could not be sent; nothing was changed | Toast: "The email could not be sent. Nothing was changed. Try again later." |
| `500` | Unexpected server error | Generic error with a "Try again" button; report to error tracking (without secrets). |

Error bodies are described in section 4.3. There are no machine-readable error codes yet; where the UI must tell two
`403`s apart (login), it compares the `detail` text, as listed in the login step. That is fragile, so it is gap G-4.

### 3.8 Platform users and `X-Tenant-Id`

Super users live in the Platform tenant. To work **inside** a customer tenant they keep using the normal endpoints
(`/api/users`, `/api/roles`, `/api/clients`, ...) and add one header:

```http
GET /api/users?page=0&size=20
Authorization: Bearer <platform user's access token>
X-Tenant-Id: 42
```

- The request then works in tenant 42 as if the platform user were a member of it, limited by what they hold there:
  - the **platform root** holds every key in every tenant (also in suspended tenants, for support);
  - other platform users hold what their **grants** give on tenant 42 or on all tenants (a granted platform role gives
    its permissions, a granted permission gives itself).
- The header is **ignored for tenant users**: they always work in their own tenant.
- A header that isn't a number gives `400` "X-Tenant-Id must be a tenant id"; an unknown tenant gives `404`
  "Tenant not found". Both come *before* anything else in the request.
- Without the header, a platform user works in the Platform tenant, where their normal roles apply and grants don't.
- Changing your own password (`PATCH /api/users/password`) always changes *your* password, header or not.
- Platform endpoints (`/api/platform/**`) are called **without** the header.

UI design: a **tenant switcher** in the console header, visible only to platform users. Choosing a tenant sets the
"acting tenant" in the app state; the API client adds `X-Tenant-Id` to every tenant-level call while it is set, and the
whole UI shows a coloured banner "Acting in tenant **Globex** (#42) as platform user. Exit". Leaving clears the header and
the data cache. Calls about *yourself* (loading your own profile, logout, change password, platform endpoints) never
send the header.

### 3.9 Deciding what to show: permissions in the UI

**`GET /api/me`** (any logged-in **management** user, no permission key needed) answers who you are and exactly which
permission keys you hold in the tenant the request works in. The server computes the keys with the same rules it uses
for every permission check, so the console never has to work them out.

```json
{
  "id": 7,
  "username": "alice",
  "fullName": "Alice Admin",
  "email": "alice@globex.com",
  "emailVerified": false,
  "userType": "MANAGEMENT",
  "rootUser": false,
  "homeTenant":    { "id": 3, "name": "Globex", "type": "STANDARD", "status": "ACTIVE" },
  "workingTenant": { "id": 3, "name": "Globex", "type": "STANDARD", "status": "ACTIVE" },
  "permissions": ["clients:read", "permissions:read", "roles:read", "users:read"]
}
```

| What | From the answer |
|---|---|
| Am I a platform user? | `homeTenant.type === "PLATFORM"` |
| Am I a root? | `rootUser` (a tenant root holds every TENANT key; the platform root holds every key, `tenants:*` included) |
| What may I do here? | `permissions` (keys, sorted). Without `X-Tenant-Id` they are your permissions in your own tenant |
| What may I do while acting? | Call it **with** `X-Tenant-Id`: `workingTenant` is that tenant and `permissions` are what your grants give you there |

| Status | Message | UI |
|---|---|---|
| `200` | | Fill the permission store |
| `401` | | Standard refresh/login handling |
| `403` | "Only management users can use this endpoint" | A regular user in the console: log out with "This console is for administrators" (the console login already refuses regular users, so this is rare) |

Not included (gap G-16): which tenants a non-root platform user holds `tenants:*` keys on. A platform user's own-tenant
`permissions` contain `tenants:*` only for the platform root; for others, `GET /api/platform/tenants` lists the tenants
they may read (possibly none), and each tenant action answers `403` when they lack it there.

If `/api/me` itself fails (network, `5xx`), fall back to **optimistic mode**: show the navigation items, and let each page
handle its own `403` with an inline "You don't have permission to view this" panel.

Keep it behind one interface so pages never call the endpoint directly:

```ts
interface PermissionSource {
  load(actingTenantId?: number): Promise<CurrentUser>;   // GET /api/me, with X-Tenant-Id when acting
}
// CurrentUser = the /api/me answer; keys: Set<string> | 'unknown' (optimistic mode)
```

Rules for using permissions in the UI:
- **Hide** navigation entries and page-level "New ..." buttons the user can't use.
- **Disable with a tooltip** (not hide) row actions blocked by a business rule, so users learn why: "You can't change
  your own roles", "The root user can't be deleted", "The management console can't be suspended".
- The server is always the authority: every action still handles `403`.
- Permissions change immediately on the server. Reload the permission view on window focus, after any `403`, and after
  editing roles or users.

---

## 4. API conventions

### 4.1 Base URL, CORS and the dev proxy

- Base URL from env: `VITE_IAM_API_BASE_URL` (e.g. `http://localhost:8080`). All paths in this document are relative to
  it.
- **CORS allowlist.** The backend lets a browser app on another origin call it only when that exact origin is in its
  `IAM_CORS_ALLOWEDORIGINS` setting (comma-separated, e.g. `http://localhost:5173,https://console.example.com`). Ask
  whoever runs the backend to add every origin you serve an app from (dev server, staging, production; one entry per
  scheme + host + port). An unlisted origin gets `403` "Invalid CORS request" on every call, preflights included.
  - Allowed: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`; request headers `Authorization`, `Content-Type`, `X-Tenant-Id`
    only (don't add custom headers such as `X-Request-Id`; the preflight would be refused).
  - **No credentials:** call `fetch` without `credentials: 'include'`. Tokens go in the `Authorization` header and in
    request bodies, never in cookies.
  - Running the backend locally: put `IAM_CORS_ALLOWEDORIGINS=http://localhost:5173` in its `.env`.
  - A same-origin setup (Vite dev proxy forwarding `/api` and `/.well-known`, or a reverse proxy in production) still
    works and needs no allowlist entry; set `VITE_IAM_API_BASE_URL` to an empty string then.
  - A tenant's own app on its own domain needs its origin in the same list for now; per-client allowed origins are
    backend roadmap item 7 (gap G-26).
- Swagger UI: `http://localhost:8080/swagger-ui.html`; OpenAPI JSON: `/v3/api-docs` (use it to generate TypeScript
  types, then check them against this document).
- Start the backend locally with `docker compose up db` and `./gradlew bootRun` in the backend repo (profile `local`),
  or `docker compose up --build app db` (profile `dev`). Both need a complete `.env` (copy `example.env`: database,
  issuer, mail, CORS with the console's origin, signing key, platform root; the backend manual, section 2). App on
  port 8080 unless `SERVER_PORT` says otherwise.

### 4.2 Requests

- JSON bodies with `Content-Type: application/json`.
- **Field names are mixed**: `client_id`, `refresh_token`, `access_token` are snake_case; everything else is camelCase
  (`newPassword`, `userType`, `roleIds`, `tenantName`, `accessTokenTtlSeconds`). Copy them exactly from each step.
- Several **`DELETE` requests carry a JSON body** (`/api/users/roles`, `/api/users/permissions`, `/api/roles/permissions`,
  `/api/platform/grants/roles`, `/api/platform/grants/permissions`). `fetch` supports this; make sure no proxy or
  HTTP library strips it.
- User role and direct-permission changes identify the user by **`username`**; platform grants identify the user by
  **`userId`**. Don't mix them up.
- Assignments are **add/remove**, never "replace the set". Editors compute the difference between the old and new
  selection and send one `PUT` (added ids) and/or one `DELETE` (removed ids).

### 4.3 Responses and errors

Every error is an RFC 9457 problem (`Content-Type: application/problem+json`, since 2026-10-27):

```json
{ "title": "Conflict", "status": 409, "detail": "Role name already exists", "instance": "/api/roles" }
```

`detail` is the text to show, `title` the status's standard name, `instance` the request path; `type` is left out
(it means `about:blank`). Invalid input adds `errors`: a `422` for the request body, a `400` for query parameters
(`page`, `size`):

```json
{
  "title": "Unprocessable Content",
  "status": 422,
  "detail": "Some fields are invalid",
  "instance": "/api/clients/7/token-settings",
  "errors": [ { "field": "accessTokenTtlSeconds", "message": "Access token lifetime must be between 60 and 3600 seconds" } ]
}
```

Exceptions to plan for:
- A browser request from an origin that isn't allowed gets Spring's plain `403` ("Invalid CORS request"), not a problem.
  (In practice the browser blocks the call and `fetch` throws a network error before any body is readable.)
- Every `401` has the problem shape, from protected endpoints too.
- The two password-reset endpoints answer `200` with a **plain text string**, not JSON (step 7).
- Introspection always answers `200` (step 25).

Normalize every failure into one TypeScript type in the API client:

```ts
type ApiError = {
  status: number;                          // HTTP status
  message: string;                         // body.detail, or a default per status
  fieldErrors: Record<string, string>;     // from body.errors[] (field -> message)
  raw?: unknown;
};
```

### 4.4 Paging

Two lists are paged: `GET /api/users` and `GET /api/platform/tenants`. Query `page` (0-based, default 0) and `size`
(default 20, **capped at 100** by the server; a negative page or a size below 1 is `400`). Always sorted by id. No
search, filter or sort parameters exist (gap G-9). Response:

```json
{
  "content": [ ... ],
  "page": { "size": 20, "number": 0, "totalElements": 57, "totalPages": 3 }
}
```

Roles, clients and permissions are returned as **plain arrays** (not paged); filter and sort them in the browser.

### 4.5 Data shapes used everywhere

```jsonc
// UserDto
{ "id": 7, "tenantId": 3, "username": "bob", "fullName": "Bob Manager", "email": "bob@example.com",
  "emailVerified": true,                                                    // the user typed a code sent there (step 28)
  "rootUser": false, "userType": "MANAGEMENT", "createdBy": "globex-root",   // creator's username, null if none
  "active": true,                                                           // false = deactivated (step 26)
  "lockedUntil": "2026-10-27T09:15:00Z",                                    // only while a login lockout runs (step 26)
  "roleIds": [2], "permissionIds": [6] }                                    // root: both empty, holds all implicitly

// RoleDto
{ "id": 2, "name": "USER_MANAGER", "description": "...", "permissionIds": [1, 2, 4, 5] }

// PermissionDto
{ "id": 1, "name": "users:read", "scope": "TENANT", "description": "..." }

// ClientDto
{ "id": 1, "client_id": "<client_id>", "name": "Management Console", "type": "MANAGEMENT_CONSOLE",
  "status": "ACTIVE",
  "tokenSettings": { "accessTokenTtlSeconds": 300, "refreshTokenEnabled": true,
                     "refreshTokenTtlSeconds": 86400, "claims": ["USERNAME"] } }

// TenantDto
{ "id": 3, "name": "Globex", "type": "STANDARD", "status": "ACTIVE" }
```

Enums: `userType` `MANAGEMENT|REGULAR`; client `type` `MANAGEMENT_CONSOLE|APPLICATION`; client/tenant `status`
`ACTIVE|SUSPENDED`; tenant `type` `STANDARD|PLATFORM`; permission `scope` `TENANT|PLATFORM`; token `claims`
`USERNAME|EMAIL|FULL_NAME|USER_TYPE|TENANT_ID`.

Not available in any DTO (design around it): user active/locked state, user created/last-login dates, tenant creation
date, tenant root user, client creation date, role names inside `UserDto` (join with `GET /api/roles`).

---

## 5. Shared UI rules

**Password policy** (mirror client-side, the server re-checks): at least 8 characters, at least one uppercase letter, one
lowercase letter, one digit and one special character, and **no whitespace**. Use the backend's exact regular expression
so the client never accepts what the server rejects:

```ts
// Same as the backend's UserValidator. Accepted specials: exactly @ # ! $ % ^ & - + = ( )
export const PASSWORD_POLICY = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[@#!$%^&\-+=()])(?=\S+$).{8,}$/;
```

Show a live checklist under every new-password field (8+ chars, upper, lower, digit, special from
`@ # ! $ % ^ & - + = ( )`, no spaces). Server message on failure (`400`): "Password must be at least 8 characters long and
contain at least one uppercase letter, one lowercase letter, one number, and one special character."

**Business rules every screen respects:**

| Rule | Where it shows up |
|---|---|
| Nobody changes their own roles or direct permissions (`403`) | User detail of yourself: access editor read-only, with a note |
| Nobody edits, re-permissions or deletes a role they hold (`403`) | Role detail of a role you hold: read-only, with a note |
| Regular users can't hold roles or permissions (`400`) | Access editor hidden for regular users |
| Root user: can't be deleted (`403`), nobody else resets its password (`403`), its access isn't editable (holds everything) | User detail of root: those actions disabled, "All permissions (root)" badge |
| You can't reset your own password through the admin action (`403`) | Use "Change password" instead |
| The management console client can't be deleted or suspended (`400`) | Client detail of the console: buttons disabled |
| The Platform tenant has only management users and only its console (`400`) | In the Platform tenant: no "Regular user" option, no "New application" |
| The Platform tenant can't be suspended (`400`) | Tenant detail of Platform: no "Suspend" |
| Forgot-password never reveals whether an account exists | Same success message for every identifier |
| User type never changes | Shown read-only after creation |

**Common states for every page:** loading (skeletons for tables, spinners on buttons), empty (explanation + main action),
error (message + "Try again"), forbidden (inline panel, not a redirect), not found (`404` page with a back link).
Destructive actions (delete, suspend, reset password) always use a confirmation dialog that names the target.

---
## 6. Step-by-step build plan

How to read each step:
- **Goal / user story**: what the user gets.
- **Access**: who may open it, by level and permission key.
- **Route**: the URL in the app. Routes are listed per app (console = app A, auth = app B); each app serves its routes at
  its own root.
- **Mockup**: layout, not visual design.
- **API calls**: every call, with request, response, errors and the UI's reaction.
- **Validation** and **business rules**: what to mirror client-side.
- **States** and **acceptance criteria**.

Order: Phase 0 builds the skeleton nothing works without. Phase 1 lets people in. Phase 2 is the tenant admin product
(the bulk of the value). Phase 3 adds super-user features. Phase 4 finishes the end-user pages and the developer guide.
Phase 5 waits on backend work.

---

### Phase 0: foundations

### Step 1: Create the project

**Goal.** A repository both apps build from, with shared packages, linting, tests and environment config.

**Recommended stack and why:**

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | Many similar DTOs and enums; catches snake_case/camelCase mistakes at compile time. |
| UI library | React 19 | Largest hiring pool and ecosystem for admin UIs. |
| Build | Vite | Fast dev server; its built-in proxy is an option when the dev origin isn't in the backend's CORS allowlist. |
| Monorepo | pnpm workspaces | Two apps + shared packages without publishing anything. |
| Routing | React Router (data router) | Nested layouts, route-level loaders and guards. |
| Server state | TanStack Query | Caching, paging, invalidation after mutations; one place to plug in the 401 handling. |
| Components | Mantine (core, form, modals, notifications) | Complete admin component set (tables, drawers, multiselect, steppers) with good accessibility; little custom CSS. |
| Forms + validation | React Hook Form + Zod | Zod schemas double as the client-side mirror of backend rules (password policy, TTL ranges). |
| Types | `openapi-typescript` from `/v3/api-docs` | Generated DTO types, checked by hand against this document. |
| Tests | Vitest + Testing Library + MSW; Playwright end-to-end against the real backend in Docker | MSW mocks the API for unit tests; Playwright proves the real flows. |
| Lint/format | ESLint + Prettier | Standard. |

**Layout:**

```
iam-frontend/
  apps/
    console/            app A: Management Console
    auth/               app B: Hosted Auth Pages
  packages/
    iam-client/         API client, error normalization, token store, refresh lock, permission source, Zod schemas
    ui/                 shared components: PasswordField + policy checklist, ConfirmDialog, ErrorPanel, PagedTable
  .env.example
```

**Environment variables** (per app, `.env.local`, never committed with real values):

| Variable | Example | Used by |
|---|---|---|
| `VITE_IAM_API_BASE_URL` | `http://localhost:8080` (origin in the backend's CORS allowlist), or empty with the dev proxy | both |
| `VITE_IAM_PROXY_TARGET` | `http://localhost:8080` | Vite dev proxy (optional), both |
| `VITE_PLATFORM_CONSOLE_CLIENT_ID` | `<platform_console_client_id>` | console (`/login/platform`) |
| `VITE_AUTH_PAGES_BASE_URL` | `https://auth.example.com` | console (links shown to admins, developer guide) |
| `VITE_CONSOLE_BASE_URL` | `https://console.example.com` | console (personal login link after signup) |

**Acceptance criteria**
- [ ] `pnpm dev` starts both apps; `/api/*` and `/.well-known/*` are proxied to the backend.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` pass in CI.
- [ ] Generated API types exist and compile.
- [ ] No secrets, client ids or passwords committed (`.env.example` holds placeholders only).

---

### Step 2: App shell, index page and layout

**Goal.** The console's frame: header, side navigation, content area, notifications. The auth app's minimal centred
card layout.

**Access.** The shell renders for everyone; navigation content depends on the session (steps 3 and 8).

**Routes.** Console: `/` (redirects to `/dashboard` when logged in, to `/login` otherwise). Auth app: `/` shows a short
"Open this page from your application's link" message.

**Mockup: console shell (logged in)**

```
+----------------------------------------------------------------------------------------+
| [IAM Console]   Globex (#3)               [Act in tenant: -- v] (platform only)  [JR v] |
+-----------------+----------------------------------------------------------------------+
| Dashboard       |  <breadcrumbs>                                                       |
| Users           |                                                                      |
| Roles           |  <page content>                                                      |
| Permissions     |                                                                      |
| Applications    |                                                                      |
| ---- Platform   |                                                                      |
| Tenants         |                                                                      |
| Platform users  |                                                                      |
| ----------------|                                                                      |
| Developer guide |                                                                      |
+-----------------+----------------------------------------------------------------------+
  [JR v] menu: My account | Change password | Log out
```

When a platform user acts in another tenant, a full-width banner sits under the header on every page:

```
+----------------------------------------------------------------------------------------+
| ! Acting in tenant "Globex" (#3) as a platform user. Every action is audited.   [Exit] |
+----------------------------------------------------------------------------------------+
```

**Mockup: auth app card layout**

```
+------------------------------------------+
|              [ IAM logo ]                |
|  <page title>                            |
|  <form>                                  |
|                                          |
|  <links>                                 |
+------------------------------------------+
```

**API calls.** None.

**Acceptance criteria**
- [ ] Responsive down to 360 px (side nav collapses into a drawer).
- [ ] Global toast area for success and error messages.
- [ ] Keyboard navigable, visible focus, a page title per route.

---

### Step 3: Routing and route guards

**Goal.** Every route declares who may open it; anonymous users land on login and come back afterwards.

**Console routes (complete list):**

| Route | Page | Guard |
|---|---|---|
| `/signup` | Tenant signup (step 5) | Anonymous only |
| `/signup/done` | Signup success (step 5) | Anonymous; state from signup |
| `/login`, `/login/:clientId`, `/login/platform` | Login (step 6) | Anonymous only |
| `/forgot-password/:clientId` | Forgot password (step 7) | Anonymous |
| `/dashboard` | Dashboard (step 8) | Logged in |
| `/account`, `/account/password` | My account, change password (step 9) | Logged in |
| `/users` | Users list (step 10) | `users:read` |
| `/users/new` | Create user (step 12) | `users:create` |
| `/users/:id` | User detail (steps 11, 13) | `users:read` |
| `/roles` | Roles list (step 14) | `roles:read` |
| `/roles/:id` | Role detail (step 15) | `roles:read` |
| `/permissions` | Permission catalog (step 16) | `permissions:read` |
| `/applications` | Clients list (step 17) | `clients:read` |
| `/applications/:id` | Client detail (step 18) | `clients:read` |
| `/platform/tenants` | Tenants (step 19) | Platform user |
| `/platform/tenants/new` | Create tenant (step 20) | Platform user (server checks `tenants:create` on all tenants) |
| `/platform/tenants/:id` | Tenant detail (step 21) | Platform user |
| `/platform/users`, `/platform/users/:id/grants` | Platform users and grants (step 23) | Platform user, not acting in a tenant |
| `/developers` | Developer guide (step 25) | Logged in |
| `*` | Not found | Anyone |

**Auth app routes:** `/:clientId/login`, `/:clientId/forgot-password`, `/:clientId/reset`, `/:clientId/account`
(steps 6, 7, 9, 24).

**Guard behaviour**
- Not logged in → redirect to the last used `/login/:clientId` (or `/login`) with `?returnTo=<path>`.
- Logged in on an anonymous-only route → `/dashboard`.
- Permission guard, permissions known, key missing → render the "Forbidden" panel in place (no redirect, the URL stays
  shareable). In optimistic mode (section 3.9) → render the page and let its API calls decide.
- Platform-only route for a tenant user → the Not found page (don't advertise platform features).

**Acceptance criteria**
- [ ] Deep links work after login (`returnTo`); `returnTo` accepts only relative paths of the same app (no open redirect).
- [ ] Guards read permissions from the single permission store (step 8).

---

### Step 4: API client layer and session store

**Goal.** One module through which every request goes. Pages never call `fetch` directly.

**Responsibilities of `packages/iam-client`:**

1. **Base URL and JSON.** Prefix `VITE_IAM_API_BASE_URL`; send and accept JSON; allow a body on `DELETE`; accept a text
   body for the two password-reset endpoints.
2. **Auth header.** Add `Authorization: Bearer <access token>` to every non-public call. Public calls (no header):
   `/api/tenants/signup`, `/api/auth/authenticate`, `/api/auth/token/refresh`, `/api/auth/introspect`,
   `/api/password/reset-request`, `/api/password/reset`, `/.well-known/jwks.json`.
3. **Acting tenant.** Add `X-Tenant-Id: <id>` when an acting tenant is set **and** the call is tenant-level
   (`/api/users*`, `/api/roles*`, `/api/permissions*`, `/api/clients*`), except calls flagged `self: true` (loading my own
   profile and permissions, change password, logout). Never on `/api/platform/**` or public calls.
4. **Error normalization.** Turn every non-2xx into `ApiError` (section 4.3). Handle an empty or non-JSON body (a
   network failure, a proxy error page) with a default message per status.
5. **Refresh on 401.** As in section 3.5: single-flight within the tab, Web Locks across tabs, retry the original call
   once, then emit `sessionEnded`.
6. **Proactive refresh timer** from the token response's `expires_in`.
7. **Session store.** `{ accessToken (memory), refreshToken (localStorage), clientId, userId, homeTenantId, exp }`, plus
   `BroadcastChannel` sync of `refreshed` and `logout` events across tabs.
8. **Token decoding.** `decodeAccessToken(jwt)` → `{ sub, iss, tenantId (from iss), clientId, sid, exp, ...optional claims }`.
9. **Typed endpoint functions**, one per endpoint in section 7, so code review can check coverage against the matrix.
10. **No secrets in logs.** Error reports drop the bodies of auth and password calls.

```ts
// Sketch, not final code
async function request<T>(method: string, path: string, opts: {
  body?: unknown; auth?: boolean; self?: boolean; text?: boolean; retried?: boolean
} = {}): Promise<T> { /* adds headers, normalizes errors, refresh-and-retry once on 401 */ }
```

**TanStack Query conventions.** Query keys include the acting tenant id (`['users', actingTenantId, page, size]`) so
switching tenants never shows another tenant's cached data. Mutations invalidate the related lists and the permission
store (step 8).

**Acceptance criteria**
- [ ] Unit test (MSW): two parallel `401`s trigger exactly **one** refresh call; both requests are retried once.
- [ ] Two tabs (Playwright) refreshing at the same moment cause one server refresh, and the session survives.
- [ ] A refresh `401` clears the session in all tabs and lands on login with "Your session has ended".
- [ ] `X-Tenant-Id` is sent only on tenant-level calls while acting, never on platform or `self` calls.
- [ ] `422` `errors[]` become field errors in forms.

---

### Phase 1: getting in

### Step 5: Tenant signup

**Goal / user story.** *As a company admin, I want to create my organization's tenant and my own root account, so that I
can start managing users.*

**Access.** Public (anonymous). The same form is reused by platform users in step 20 (different endpoint).

**Routes.** `/signup` → `/signup/done`.

**Mockup: `/signup`**

```
+--------------------------------------------------------------+
|  Create your organization                                    |
|                                                              |
|  Organization                                                |
|  Organization name*  [ Globex                            ]   |
|                                                              |
|  Your root account (full control of the organization)        |
|  Username*           [ globex-root                       ]   |
|  Full name           [ Globex Root                       ]   |
|  Email               [ root@example.com                  ]   |
|    Required: password resets are sent here.                  |
|  Password*           [ ************                 (o) ]   |
|    [x] 8+ characters  [x] upper  [x] lower  [x] digit        |
|    [ ] special (@ # ! $ % ^ & - + = ( )) [x] no spaces       |
|  Confirm password*   [ ************                     ]   |
|                                                              |
|                         [ Create organization ]              |
|  Already have one? Log in                                    |
+--------------------------------------------------------------+
```

**Mockup: `/signup/done`**

```
+--------------------------------------------------------------+
|  Globex is ready                                             |
|                                                              |
|  Your console login link (bookmark it):                      |
|  https://console.example.com/login/<console_client_id> [Copy]|
|                                                              |
|  Console ID:  <console_client_id>                      [Copy]|
|  Username:    globex-root                                    |
|                                                              |
|  Included: roles ADMIN, USER_MANAGER, VIEWER and a           |
|  management console for your admins.                         |
|                                                              |
|                         [ Log in now ]                       |
+--------------------------------------------------------------+
```

**API call: `POST /api/tenants/signup`** (public)

```json
{
  "tenantName": "Globex",
  "rootUser": {
    "username": "globex-root",
    "password": "Password1!",
    "fullName": "Globex Root",
    "email": "root@example.com"
  }
}
```

`201 Created`:

```json
{
  "tenant": { "id": 3, "name": "Globex", "type": "STANDARD", "status": "ACTIVE" },
  "rootUser": { "id": 11, "tenantId": 3, "username": "globex-root", "fullName": "Globex Root",
                "email": "root@example.com", "rootUser": true, "userType": "MANAGEMENT",
                "createdBy": null, "roleIds": [], "permissionIds": [] },
  "managementConsole": { "id": 5, "client_id": "<console_client_id>", "name": "Management Console",
                         "type": "MANAGEMENT_CONSOLE", "status": "ACTIVE",
                         "tokenSettings": { "accessTokenTtlSeconds": 300, "refreshTokenEnabled": true,
                                            "refreshTokenTtlSeconds": 86400, "claims": ["USERNAME"] } }
}
```

| Error | When | UI |
|---|---|---|
| `409` "Tenant name not available" | Name taken (also "Platform", which always exists) | Error under *Organization name* |
| `409` "Username not available" | Any user of any tenant uses it (root usernames are global) | Error under *Username* |
| `409` "Email not available" | Any user of any tenant uses it | Error under *Email* |
| `400` password policy message | Policy failed | Error under *Password* |
| `422` | Missing `tenantName`, `rootUser`, `rootUser.username` or `rootUser.password`, or an invalid email; `errors[].field` is e.g. `tenantName`, `rootUser.username`, `rootUser.email` | Map to fields |

`userType` is ignored at signup (the root is always `MANAGEMENT`); don't send it.

**Validation.** Organization name required; username required (trim); password per policy, confirm must match (client
only); email required and well-formed (`422` "Email should be a valid email address" otherwise); full name optional.

**Business rules.** The new tenant gets the three predefined roles and its console. Signup does **not** log the user in.
Save `{ clientId, tenantName }` in the "recent consoles" list (`localStorage`); never the password.

**States.** The submit button shows a spinner and is disabled while pending. On success navigate to `/signup/done` with
the result in router state; if that page is reloaded without state, show "Log in with your console link".

**Acceptance criteria**
- [ ] A successful signup shows the console link and console id with copy buttons.
- [ ] "Log in now" opens `/login/<console_client_id>` with the username pre-filled.
- [ ] Each server error appears next to the right field; the form keeps its values (except the passwords).
- [ ] The password checklist matches the server's policy exactly (specials `@ # ! $ % ^ & - + = ( )`).

---

### Step 6: Login

**Goal / user story.** *As an admin, I want to log in to my organization's console.* (console) *As an end user, I want
to log in to my account.* (auth app)

**Access.** Anonymous. Console: management users only (the server enforces it). Auth app: any user of the client's tenant.

**Routes.** Console: `/login` (asks for the console id), `/login/:clientId`, `/login/platform` (uses
`VITE_PLATFORM_CONSOLE_CLIENT_ID`). Auth app: `/:clientId/login`.

**Mockup: console `/login/:clientId`**

```
+--------------------------------------------------------------+
|  Log in to the console                                       |
|  Organization: Globex        (not yours? use another console)|
|                                                              |
|  Username   [ globex-root                               ]    |
|  Password   [ ************                         (o) ]    |
|                                                              |
|  <inline error area>                                         |
|                              [ Log in ]                      |
|  Forgot password?                                            |
+--------------------------------------------------------------+
```

The organization name comes from the "recent consoles" list when known; otherwise show "Console <first 6 characters>...".

**Mockup: console `/login` (no console id yet)**

```
+--------------------------------------------------------------+
|  Log in to the console                                       |
|  Recent:  ( Globex )  ( Initech )                            |
|                                                              |
|  Console ID [ ________________________ ]                     |
|             From your signup page or your admin's link.     |
|  Username   [ ______________ ]                               |
|  Password   [ ______________ ]                               |
|                              [ Log in ]                      |
|  New here? Create an organization  |  Platform administrator |
+--------------------------------------------------------------+
```

**API call: `POST /api/auth/authenticate`** (public)

```json
{ "client_id": "<client_id>", "username": "globex-root", "password": "Password1!" }
```

`200` → `{ "access_token": "...", "token_type": "Bearer", "expires_in": 300, "refresh_token": "...", "username": "..." }`
(`refresh_token` absent when disabled; section 3.1).

| Status | Exact message | UI |
|---|---|---|
| `401` | "Unknown client_id" | Console: "This console link is not valid." and show the Console ID field. Auth app: full page "This application link is not valid." |
| `401` | "Bad credentials" | "Wrong username or password." (never say which) |
| `403` | "Only management users can log in through the management console" | "This console is for administrators. Log in through your application instead." |
| `403` | "Tenant is suspended" | "This organization is suspended. Contact the service operator." |
| `403` | "Client is suspended" | "This application is suspended. Contact your administrator." |
| `403` | message contains "locked" (Spring's text, e.g. "User account is locked") | "Your account is locked after too many failed attempts. Try again in 15 minutes, or reset your password." + link |
| `403` | "Account is disabled" | "Your account is disabled. Contact your administrator." |
| `403` | "Password is expired. Please change your password" | "Your password has expired. Reset it to continue." + button to forgot-password with the username pre-filled (gap G-13) |
| `422` | field errors (`client_id`, `username`, `password`) | Map to fields |

**After a successful login**
1. Store tokens (section 3.4) and the `client_id`.
2. Add or refresh the console in "recent consoles".
3. Run the bootstrap (step 8) and go to `returnTo` or `/dashboard`.

**Validation.** All three fields required. Don't apply the password policy at login.

**Business rules.** 5 failed logins lock the account for 15 minutes; a password reset ends the lock early. Passwords
expire after 90 days, and an expired password blocks login.

**Acceptance criteria**
- [ ] Every error row above shows its message; a wrong username and a wrong password look identical.
- [ ] A regular user on the console sees the "administrators only" message, not a generic error.
- [ ] `/login/platform` works when the env var is set and is hidden when it isn't.
- [ ] After login, a reload keeps the user logged in (refresh token from `localStorage`).

---

### Step 7: Forgot password (request a code, then code + new password)

**Goal / user story.** *As a user who forgot my password, I want to receive a code by email and choose a new password.*

**Access.** Public. Works through **any** client of the user's tenant (console or application).

**Routes.** Console: `/forgot-password/:clientId` (two screens, one route with a step state). Auth app:
`/:clientId/forgot-password` → `/:clientId/reset`.

**Mockup: screen 1, request**

```
+--------------------------------------------------------------+
|  Reset your password                                         |
|  Enter your username or email. If an account matches and     |
|  has an email address, we'll email it a 6-digit code.        |
|                                                              |
|  Username or email [ jane@example.com                    ]   |
|                                                              |
|                          [ Send code ]                       |
|  Back to login                                               |
+--------------------------------------------------------------+
```

**Mockup: screen 2, reset**

```
+--------------------------------------------------------------+
|  Check your email                                            |
|  If an account matches "jane@example.com", a code is on its  |
|  way. It is valid for 5 minutes.                             |
|                                                              |
|  Code (6 digits)    [ _ _ _ _ _ _ ]                          |
|  New password       [ ************                 (o) ]     |
|    [x] 8+  [x] upper  [x] lower  [x] digit  [ ] special      |
|  Confirm password   [ ************                     ]     |
|                                                              |
|                        [ Set new password ]                  |
|  No code? Send a new one (available in 60 s)                 |
+--------------------------------------------------------------+
```

**API call 1: `POST /api/password/reset-request`** (public)

```json
{ "client_id": "<client_id>", "identifier": "jane@example.com" }
```

`200` with a **plain text** body:

```
If the account exists and has an email address, a password reset OTP has been sent to it.
```

The answer is identical whether or not the account exists, has an email, is over the hourly limit, or the email failed.
**Always** move on to screen 2 with the neutral text. Never claim "We sent you a code" as a fact.

| Status | When | UI |
|---|---|---|
| `401` "Unknown client_id" | Bad link | "This link is not valid." |
| `403` "Tenant is suspended" / "Client is suspended" | | Show the message |
| `422` | `identifier` or `client_id` blank | Field error |

**API call 2: `POST /api/password/reset`** (public)

```json
{ "client_id": "<client_id>", "identifier": "jane@example.com", "otp": "123456", "newPassword": "Password1!" }
```

`200` with a plain text body: `Your password has been reset. Log in with your new password.`
Then go to login with a success toast; pre-fill the username when the identifier wasn't an email.

| Status | When | UI |
|---|---|---|
| `400` "Invalid or expired OTP" | Unknown user, no pending code, expired code, or wrong code (each wrong guess counts; the 5th deletes the code) | "The code is wrong or has expired." Count attempts locally; after the 5th: "Too many wrong codes. Request a new code." and go back to screen 1. |
| `400` password policy message | New password too weak | Error under *New password*. **The code stays valid**: keep it in its field. |
| `401` / `403` | Client problems as above | Show the message |
| `422` | Missing field (`otp`, `newPassword`, ...) | Field errors |

**Validation.** Identifier required (trim). Code exactly 6 digits (accept a pasted code; strip spaces). New password per
policy; confirm matches.

**Business rules.**
- A code is valid **5 minutes**; a new request **replaces** the previous code; at most **3 codes per user per hour**
  (further requests get the same neutral answer but send nothing); **5 wrong guesses** delete the code.
- "Send a new one" has a 60-second client-side cooldown; after 3 sends in this browser session add the hint "You can
  request at most 3 codes per hour."
- Success ends **all** the user's sessions and any login lockout, and starts a fresh 90-day password expiry.
- The identifier is matched by username first, then by email, inside the client's tenant.

**Acceptance criteria**
- [ ] Unknown and known identifiers produce exactly the same screens and texts.
- [ ] A weak new password keeps the code and shows the policy error.
- [ ] Five wrong codes send the user back to screen 1.
- [ ] The code and passwords never appear in the URL, browser storage or logs.

---

### Step 8: Session bootstrap, dashboard and permission-driven navigation

**Goal / user story.** *As a logged-in admin, I want to see only the parts of the console I can use, and a start page
that tells me where I am.*

**Access.** Any logged-in console user.

**Route.** `/dashboard`.

**Bootstrap after login or reload:** one call, `GET /api/me` (section 3.9), **without** `X-Tenant-Id` (with it while
acting, step 22). Keep the answer in the permission store used by guards and navigation. Reload it on window focus (at
most once a minute), after any `403`, and after mutations on roles or users. If the call fails, use optimistic mode.

**Navigation rules**

| Nav item | Shown when |
|---|---|
| Dashboard, Developer guide | Always |
| Users | `users:read` |
| Roles | `roles:read` |
| Permissions | `permissions:read` |
| Applications | `clients:read` |
| Platform section: Tenants | Platform user (`homeTenant.type` is `PLATFORM`) |
| Platform section: Platform users | Platform user, not acting in a tenant |

In optimistic mode show all tenant items; pages handle `403` inline.

**Mockup: `/dashboard`**

```
+---------------------------------------------------------------------------+
|  Welcome, Globex Root                                                     |
|  Organization: Globex (#3)    You are: Root user (all permissions)         |
|                                                                           |
|  +----------------+  +----------------+  +----------------+               |
|  | Users          |  | Roles          |  | Applications   |               |
|  | 57             |  | 4              |  | 3              |               |
|  | [Manage]       |  | [Manage]       |  | [Manage]       |               |
|  +----------------+  +----------------+  +----------------+               |
|                                                                           |
|  Getting started                                                          |
|   [x] Organization created                                                |
|   [ ] Create a management user          -> /users/new                     |
|   [ ] Register your first application   -> /applications                  |
|   [ ] Read the developer guide          -> /developers                    |
+---------------------------------------------------------------------------+
```

Counts: `GET /api/users?page=0&size=1` (`page.totalElements`), `GET /api/roles` (array length), `GET /api/clients`
(array length). Each card renders only when the user holds the read key; a refused call hides the card. Platform users
(not acting) also get a "Tenants" card from `GET /api/platform/tenants?page=0&size=1`.
"You are" shows "Root user (all permissions)", "Platform root (everything, everywhere)", or "Management user" with the
number of permissions held (role names need `GET /api/users/{id}` + `GET /api/roles`, so show them only with
`users:read` and `roles:read`). Organization = `workingTenant.name`.

**Acceptance criteria**
- [ ] A `VIEWER`-only user sees Users, Roles, Permissions and Applications, but no create/edit buttons anywhere.
- [ ] A user whose roles change in another browser sees the new navigation after focusing the window.
- [ ] A tenant user never sees the Platform section; the bootstrap makes exactly one call (`GET /api/me`).

---

### Step 9: My account, change password, log out

**Goal / user story.** *As any logged-in user, I want to see my profile, change my password, and log out.* *As a
management user, I also want to fix my own name and email.*

**Access.** Any logged-in user (console and auth app).

**Routes.** Console: `/account`, `/account/password`. Auth app: `/:clientId/account` (everything on one page, step 24).

**Mockup: `/account`**

```
+---------------------------------------------------------------+
|  My account                                                   |
|  Username      globex-root                                    |
|  Full name     Globex Root                                    |
|  Email         root@example.com                               |
|  Type          Management user   [Root]                       |
|  Organization  Globex (#3)                                    |
|  Signed in via Management Console                             |
|                                                               |
|  [ Edit profile ]  [ Change password ]         [ Log out ]    |
+---------------------------------------------------------------+
```

Profile fields come from the bootstrap (`GET /api/me`); "Organization" is `homeTenant`. Regular users (auth app) can't
call it: show only what their token holds (the `username` claim if the client includes it, user id, tenant id) plus the
actions (gap G-1).

**Edit profile (console only): `PATCH /api/me`** (any management user, no permission key, never with `X-Tenant-Id`) →
`200` with the same body as `GET /api/me`; replace the permission store's profile with it. Dialog:

```
+-----------------------------------------------------------+
|  Edit my profile                                          |
|  Full name         [ Globex Root                      ]   |
|  Email             [ root@example.com                 ]   |
|  Current password  [ ************                     ]   |
|     Needed only when you change your email.               |
|                              [ Cancel ]  [ Save ]         |
+-----------------------------------------------------------+
```

```json
{ "fullName": "Globex Boss", "email": "boss@example.com", "currentPassword": "Password1!" }
```

Send only changed fields, plus `currentPassword` when the email changed (show the field only then). `""` removes the
full name; the email can't be emptied. For the root this is the only way to change their own details.

| Status | Message | UI |
|---|---|---|
| `200` | | Toast "Profile saved"; your password reset emails now go to the new address |
| `400` | "Changing your email needs your current password, and it was missing or wrong" | Error under *Current password*. A wrong password counts like a failed login: after 5 (with login and password-change guesses) the account is locked for 15 minutes |
| `401` | (account locked by the 5th wrong password) | Standard handling: clear the session and show the login page, which then answers "locked" |
| `409` | "Email not available" | Error under *Email* (a root's email must be unused in every organization) |
| `403` | "Only management users can use this endpoint" | Not shown in the auth app (regular users can't edit their profile) |
| `422` | "Email should be a valid email address" | Error under *Email* |

**Mockup: `/account/password`**

```
+---------------------------------------------------------------+
|  Change password                                              |
|  Current password  [ ************                         ]   |
|  New password      [ ************                    (o) ]   |
|    [x] 8+ [x] upper [x] lower [x] digit [x] special          |
|  Confirm password  [ ************                         ]   |
|                                                               |
|  Changing your password signs you out on all other devices.   |
|                                  [ Cancel ]  [ Save ]         |
+---------------------------------------------------------------+
```

**API call: `PATCH /api/users/password`** (logged in, `self: true`, never with `X-Tenant-Id`)

```json
{ "oldPassword": "Password1!", "newPassword": "Password2!" }
```

`204 No Content` → toast "Password changed. You were signed out on your other devices." The current session stays
valid; no new login.

| Status | Message | UI |
|---|---|---|
| `400` | "Invalid old password" | Error under *Current password*; counts like a failed login (5 lock the account for 15 minutes, and every request then gets `401`) |
| `400` | password policy message | Error under *New password* |
| `422` | field errors (`oldPassword`, `newPassword`) | Field errors |
| `401` | session gone | Standard refresh/login handling |

Client-side extra: the new password must differ from the current one (the server doesn't check this).

**API call: `POST /api/auth/logout`** → `204`. Follow section 3.6 (always clear local state, even when the call fails).

**Acceptance criteria**
- [ ] After a password change the current tab stays logged in; another browser logged in as the same user is logged out
      at its next refresh.
- [ ] Logging out in one tab logs out every tab.
- [ ] A regular user can change their password and log out on the auth app's account page.
- [ ] A management user changes their name without a password, and their email only with the current password.

---
### Phase 2: tenant administration

Everything in this phase works the same for a tenant admin in their own tenant and for a platform user acting in a
tenant (the API client adds `X-Tenant-Id`, step 22). Every list and lookup is limited to the tenant the request works in.

### Step 10: Users list

**Goal / user story.** *As an admin, I want to browse my organization's users and find one quickly.*

**Access.** Management users with `users:read` (root and platform users acting in the tenant included).

**Route.** `/users?page=0&size=20`. Page and size live in the URL so the view is shareable.

**Mockup**

```
+--------------------------------------------------------------------------------------+
|  Users                                                          [ + New user ]       |
|  Find exact: (o) Username ( ) Email  [ bob                    ] [ Go ]               |
|                                                                                      |
|  ID | Username     | Full name       | Email              | Type        | Roles       |
|  ---+--------------+-----------------+--------------------+-------------+-------------|
|  11 | globex-root  | Globex Root     | root@example.com   | Mgmt [Root] | (all)       |
|  12 | bob          | Bob Manager     | bob@example.com    | Management  | USER_MANAGER|
|  13 | carol        | Carol Customer  | -                  | Regular     | -           |
|  ...                                                                                 |
|                                                                                      |
|  Showing 1-20 of 57      Rows per page [20 v]      [< Prev]  Page 1 of 3  [Next >]   |
+--------------------------------------------------------------------------------------+
```

Clicking a row opens `/users/:id`. "New user" shows only with `users:create`.

**API calls**

`GET /api/users?page=0&size=20` (`users:read`) → `200` paged `UserDto`s (section 4.4), ordered by id.

| Status | When | UI |
|---|---|---|
| `400` | negative page or size < 1 (only if the URL was edited) | Reset to page 0, size 20 |
| `403` | no `users:read` | Forbidden panel |

`GET /api/users/by-username?username=bob` and `GET /api/users/by-email?email=bob@example.com` (`users:read`) → `200`
one `UserDto`; `404` "User not found" → inline "No user with that username/email." On success, navigate to its detail
page. These are **exact** matches (no partial search exists, gap G-9).

`GET /api/roles` (`roles:read`, cached) to turn `roleIds` into names. Without `roles:read`, show the role count only
("2 roles").

**Rules.** Rows per page: 10, 20, 50, 100 (server cap 100). Root rows show "(all)" in Roles. Never show passwords (they
aren't returned anyway).

**States.** Loading: table skeleton. Empty (never happens in practice; the root always exists): "No users yet".
Error: panel with "Try again".

**Acceptance criteria**
- [ ] Paging works and survives reload (URL state); the total count comes from `page.totalElements`.
- [ ] Exact lookup by username and by email both open the user; not found shows the inline message.
- [ ] Role names display when `roles:read` is held, counts otherwise.

---

### Step 11: User detail (view, edit profile, delete, reset password)

**Goal / user story.** *As an admin, I want to see a user's details and access, fix their name or email, and delete the
user or force a password reset when their account may be compromised.*

**Access.** `users:read` to view; `users:update` to edit the name, plus `users:reset-password` to change the email;
`users:delete` to delete; `users:reset-password` to reset. Access editing is step 13.

**Route.** `/users/:id`.

**Mockup**

```
+--------------------------------------------------------------------------------------+
|  < Users                                                                             |
|  bob  (Bob Manager)     [ Edit profile ]  [ Reset password ]  [ Delete user ]        |
|  Management user  - created by globex-root                                           |
|                                                                                      |
|  Profile                                                                             |
|   ID          12                                                                     |
|   Username    bob                                                                    |
|   Full name   Bob Manager                                                            |
|   Email       bob@example.com                                                        |
|   Type        Management (fixed at creation)                                         |
|   Status      Active          [ Deactivate ] [ Unlock: only while locked ] (step 26) |
|                                                                                      |
|  Access                                                    [ Edit access ] (step 13) |
|   Roles:              USER_MANAGER                                                   |
|   Direct permissions: roles:read                                                     |
|   Effective:          users:read, users:create, users:update, users:delete,          |
|                       roles:read                                                     |
+--------------------------------------------------------------------------------------+
```

For the root user: a "Root" badge, Access shows "All tenant permissions (root, not editable)", Delete and Reset password
and Edit profile are disabled with tooltips ("Only the root user can change their own profile"). For a regular user:
Access shows "Regular users have no admin access" and no Edit access button. On your own page: Edit profile, Reset
password and Edit access are disabled ("Edit your profile in My account"; "Change your own password in My account";
"Someone else must change your access").

**API calls**

`GET /api/users/{id}` (`users:read`) → `200` `UserDto`. `404` "User not found" (also for users of other tenants) →
Not found page.

`GET /api/roles` and `GET /api/permissions` (cached) to show names and compute "Effective".

**Edit profile: `PATCH /api/users/{id}`** (`users:update`) → `200` `UserDto`. Dialog:

```
+-----------------------------------------------------------+
|  Edit bob                                                 |
|  Full name  [ Bob Manager                             ]   |
|  Email      [ bob@example.com                         ]   |
|     Password resets go to this address. Changing it       |
|     cancels a pending reset code.                         |
|                              [ Cancel ]  [ Save ]         |
+-----------------------------------------------------------+
```

Send only the fields that changed: `{ "fullName": "Bob Builder" }`, `{ "email": "builder@example.com" }` or both. An
emptied full name is sent as `""` (removes it). The email can't be emptied (client-side "Email is required"). Without
`users:reset-password` the email field is read-only with the tooltip "Changing an email also needs the reset-password
permission". After saving, update the page from the response and invalidate the users list.

| Status | Message | UI |
|---|---|---|
| `200` | | Toast "Profile saved" |
| `409` | "Email not available" | Error under *Email* (taken in this tenant, or by a root user of any tenant) |
| `403` | "Change your own profile through /api/me" | Shouldn't happen (disabled on your own page) |
| `403` | "Only the root user can change their own profile" | Shouldn't happen (disabled for the root) |
| `403` | "Do not have permission to perform this operation" | Missing `users:update`, or `users:reset-password` for an email change; reload permissions |
| `404` | "User not found" | Toast, go to the list |
| `422` | "Email should be a valid email address" (`errors[].field` = `email`) | Error under *Email* |

**Delete: `DELETE /api/users/{id}`** (`users:delete`) → `204`. Confirmation dialog:

```
+--------------------------------------------------+
|  Delete user "bob"?                              |
|  The user can't log in any more and all their     |
|  sessions end. Users they created are kept.       |
|  This can't be undone.                            |
|  Type the username to confirm: [ ________ ]       |
|                         [ Cancel ]  [ Delete ]    |
+--------------------------------------------------+
```

| Status | Message | UI |
|---|---|---|
| `204` | | Toast "User deleted", go to `/users`, invalidate the users list |
| `403` | "The root user can't be deleted" | Shouldn't happen (button disabled); show the message |
| `403` | "You can't delete your own account" | Shouldn't happen (button hidden on yourself); show the message |
| `403` | "Do not have permission to perform this operation" | Forbidden toast; reload permissions |
| `404` | "User not found" | Toast, go to the list |

Do not offer "Delete" on your own account: the server refuses it (`403` "You can't delete your own account").

**Reset password: `POST /api/users/{id}/password-reset`** (`users:reset-password`, no body) → `204`. Confirmation:

```
+-----------------------------------------------------------+
|  Reset bob's password?                                    |
|  - bob's current password stops working immediately.      |
|  - All of bob's sessions end.                             |
|  - bob gets a 6-digit code by email (valid 5 minutes)     |
|    and chooses a new password on the reset page.          |
|  Tell bob to open: <auth pages>/<client_id>/reset         |
|                         [ Cancel ]  [ Reset password ]    |
+-----------------------------------------------------------+
```

The email today contains **only the code, no link** (backend roadmap item 3 adds a link, gap G-14). After a successful
reset, show a copyable "where to reset" link for the admin to pass on: the auth app's reset page for one of the tenant's
application clients (pick from `GET /api/clients`; for management users the console's
`/forgot-password/<console_client_id>`).

| Status | Message | UI |
|---|---|---|
| `204` | | Toast "Reset code emailed to bob. Their password no longer works." |
| `400` | "User has no email address to send a password reset OTP to" | Error dialog; nothing changed. Offer "Edit profile" to add an email. |
| `403` | "Users cannot reset their own password; change it instead" | Link to `/account/password` |
| `403` | "Do not have permission to perform this operation" | Root's password, or missing key |
| `404` | "User not found" | Toast |
| `429` | "Too many password reset OTPs for this user in the last hour; try again later" | Toast; nothing changed |
| `503` | "The password reset email could not be sent; nothing was changed, try again later" | Toast; nothing changed |

**Acceptance criteria**
- [ ] Root, self, regular and management users each show the right enabled/disabled actions with tooltips.
- [ ] Delete requires typing the username; success returns to the list.
- [ ] Every reset outcome above shows its message; `400`, `429` and `503` say nothing was changed.
- [ ] Edit profile sends only changed fields; the email field is read-only without `users:reset-password`; an emptied
      name is removed.

---

### Step 12: Create user (regular or management)

**Goal / user story.** *As an admin, I want to create accounts for end users of our applications and for fellow admins.*

**Access.** `users:create`. The "Management user" option additionally needs `users:create-management`.

**Route.** `/users/new` (full page; a drawer works too).

**Mockup**

```
+--------------------------------------------------------------+
|  New user                                                    |
|                                                              |
|  Type*   (o) Regular user - logs in to your applications     |
|          ( ) Management user - uses this console             |
|              (needs users:create-management)                 |
|          The type can't be changed later.                    |
|                                                              |
|  Username*          [ carol                             ]    |
|  Full name          [ Carol Customer                    ]    |
|  Email              [ carol@example.com                 ]    |
|     Required: password resets are sent here.                 |
|  Initial password*  [ ************                (o) ]     |
|     [x] 8+ [x] upper [x] lower [x] digit [x] special         |
|     [ Generate ]  Share it with the user securely.           |
|                                                              |
|  (management only) After creating: [x] Go to access editor   |
|                                                              |
|                        [ Cancel ]  [ Create user ]           |
+--------------------------------------------------------------+
```

In the Platform tenant (a platform user not acting in a tenant), the type is fixed to **Management** (regular users
aren't allowed there).

**API call: `POST /api/users`** (`users:create`)

```json
{ "username": "carol", "password": "Password1!", "fullName": "Carol Customer",
  "email": "carol@example.com", "userType": "REGULAR" }
```

`userType` is `"REGULAR"` (default when omitted) or `"MANAGEMENT"`. `201` → the new `UserDto`
(`createdBy` = your username, empty `roleIds`/`permissionIds`). Then go to `/users/:id` (or straight to the access editor
for a management user).

| Status | Message | UI |
|---|---|---|
| `409` | "Username not available" | Under *Username* (taken in this tenant, or by any root user anywhere) |
| `409` | "Email not available" | Under *Email* |
| `400` | password policy message | Under *Initial password* |
| `400` | "The platform tenant has management users only" | Under *Type* |
| `403` | "Do not have permission to perform this operation" | Management chosen without `users:create-management`: under *Type*, "You can't create management users" |
| `422` | field errors (`username`, `password`, `email`) | Field errors |

**Validation.** Username required (trim); password per policy; email required and well-formed. "Generate" makes a
16-character password that satisfies the policy (with `crypto.getRandomValues`), shown once with a copy button.

**Business rules.** The user joins the tenant the request works in. Management users start with no access: they can log
in to the console but see nothing until someone gives them roles or permissions (step 13). There is no invitation
email; the admin passes the initial password on (gap G-21 covers self-registration and invitations).

**Acceptance criteria**
- [ ] The Management option is hidden without `users:create-management` (and still handled if the server says `403`).
- [ ] Every error row lands on the right field.
- [ ] Generated passwords always pass the policy regex.

---

### Step 13: User access editor (roles and direct permissions)

**Goal / user story.** *As an admin, I want to give a management user roles, and single permissions when a role would be
too much.*

**Access.** `users:update`, plus `roles:read` and `permissions:read` to show the choices. Only for **management** users,
never for yourself, never for the root (root holds everything).

**Route.** `/users/:id` → "Edit access" opens a drawer.

**Mockup**

```
+---------------------------------------------------------------+
|  Edit access: bob                                       [ x ] |
|                                                               |
|  Roles                                                        |
|   [x] ADMIN          every permission                         |
|   [ ] USER_MANAGER   users:read, users:create, ...            |
|   [x] VIEWER         users:read, roles:read, ...              |
|                                                               |
|  Direct permissions (on top of roles)                         |
|   users     [ ] read [ ] create [ ] create-management         |
|             [ ] update [ ] delete [ ] reset-password          |
|   roles     [ ] read [ ] create [ ] update [ ] delete         |
|   clients   [ ] read [ ] create [ ] update [ ] delete         |
|             [ ] suspend [ ] activate                          |
|   permissions [ ] read                                        |
|   (already granted by a role: shown checked + greyed)         |
|                                                               |
|  Effective after saving: 17 permissions          [ Preview ]  |
|                                     [ Cancel ]  [ Save ]      |
+---------------------------------------------------------------+
```

Only TENANT-scope permissions are listed (direct permissions can never be PLATFORM keys).

**API calls** (all `users:update`; the user is identified by **username**). Compute the difference between the
original and the new selection and send only what changed, roles first, then permissions:

| Change | Call | Body |
|---|---|---|
| Roles added | `PUT /api/users/roles` | `{ "username": "bob", "roleIds": [1, 3] }` |
| Roles removed | `DELETE /api/users/roles` | `{ "username": "bob", "roleIds": [2] }` |
| Permissions added | `PUT /api/users/permissions` | `{ "username": "bob", "permissionIds": [6] }` |
| Permissions removed | `DELETE /api/users/permissions` | `{ "username": "bob", "permissionIds": [9] }` |

Each answers `204`. Each call is all-or-nothing; adding something already held keeps it, removing something not held
changes nothing. After saving, reload the user (`GET /api/users/{id}`) and invalidate the permission store if you edited
anyone (cheap and keeps the UI honest).

| Status | Message | UI |
|---|---|---|
| `400` | "Regular users cannot hold roles or permissions" | Shouldn't happen (editor hidden); show it |
| `403` | "Users cannot change their own roles or permissions" | Shouldn't happen (editor disabled); show it |
| `404` | "User not found" / "Some roles not found" / "Some permissions not found" | "Something changed meanwhile. Reloaded the options." and refetch roles/permissions |
| `422` | "Role list cannot be empty" / "Permission list cannot be empty" | Bug: never send an empty list (skip the call instead) |

If one of the up to four calls fails, show which part was saved and which wasn't, and reload the user.

**Business rules.** Changes apply on the user's next request; they don't need to log in again. You may grant roles or
permissions you don't hold yourself (but never to yourself).

**Acceptance criteria**
- [ ] Only changed parts are sent; no call carries an empty list.
- [ ] Permissions already given by a selected role are shown as covered.
- [ ] The editor never opens for yourself, the root, or a regular user.

---

### Step 14: Roles list and create role

**Goal / user story.** *As an admin, I want to see my organization's roles and create new ones.*

**Access.** `roles:read` to view; `roles:create` to create.

**Route.** `/roles`; "New role" opens a dialog.

**Mockup**

```
+-----------------------------------------------------------------------------+
|  Roles                                                    [ + New role ]    |
|  Filter [ ______ ]                                                          |
|                                                                             |
|  Name          | Description                 | Permissions | You hold it    |
|  --------------+-----------------------------+-------------+--------------  |
|  ADMIN         | ...                         | 17          | yes (locked)   |
|  USER_MANAGER  | ...                         | 4           |                |
|  VIEWER        | ...                         | 4           |                |
|  AUDITOR       | Views users                 | 1           |                |
+-----------------------------------------------------------------------------+

+------------------------------------------+
|  New role                                |
|  Name*        [ AUDITOR             ]    |
|               (name is free)             |
|  Description  [ Views users         ]    |
|  You add permissions on the next page.   |
|                 [ Cancel ] [ Create ]    |
+------------------------------------------+
```

"You hold it" compares with your own `roleIds` from the bootstrap; held roles open read-only (step 15).

**API calls**

`GET /api/roles` (`roles:read`) → `200` array of `RoleDto`. Filter and sort in the browser.

`GET /api/roles/name/{name}` (`roles:read`): optional, debounced name check while typing in the dialog: `200` → "A role
with this name exists"; `404` "Role not found" → "Name is free". URL-encode the name.

`POST /api/roles` (`roles:create`)

```json
{ "name": "AUDITOR", "description": "Views users" }
```

`201` → `RoleDto` (empty `permissionIds`); navigate to `/roles/:id` to add permissions.

| Status | Message | UI |
|---|---|---|
| `409` | "Role name already exists" | Under *Name* |
| `422` | "Role name cannot be null or blank" (field `name`) | Under *Name* |
| `403` | missing key | Forbidden toast |

**Acceptance criteria**
- [ ] A new role leads straight to its permission editor.
- [ ] Held roles are marked in the list.

---

### Step 15: Role detail (rename, permissions, delete)

**Goal / user story.** *As an admin, I want to decide exactly what a role allows.*

**Access.** `roles:read` to view; `roles:update` to rename and change permissions; `roles:delete` to delete; plus
`permissions:read` for names. **Never on a role you hold** (server `403`).

**Route.** `/roles/:id`.

**Mockup**

```
+--------------------------------------------------------------------------------+
|  < Roles                                                                       |
|  USER_MANAGER                                  [ Rename ]  [ Delete role ]     |
|  Manages users                                                                 |
|  (i) You hold this role, so you can't change it.   <- only when held           |
|                                                                                |
|  Permissions                                                       [ Save ]    |
|   users        [x] read  [x] create  [ ] create-management                     |
|                [x] update  [x] delete  [ ] reset-password                      |
|   roles        [ ] read  [ ] create  [ ] update  [ ] delete                    |
|   clients      [ ] read  [ ] create  [ ] update  [ ] delete                    |
|                [ ] suspend  [ ] activate                                       |
|   permissions  [ ] read                                                        |
|   tenants (platform tenant only)                                               |
|                [ ] read  [ ] create  [ ] suspend  [ ] activate                 |
|                                                                                |
|  Users with this role: not available (gap G-9; would need a filter)            |
+--------------------------------------------------------------------------------+
```

The "tenants" group appears only in the **Platform** tenant (platform user, not acting): its roles may hold PLATFORM
keys, which take effect only through grants (step 23). Show a note there: "Platform permissions only work when this role
is granted on tenants." In standard tenants list TENANT keys only.

**API calls**

`GET /api/roles/{id}` (`roles:read`) → `RoleDto`; `404` "Role not found" → Not found page.

`PUT /api/roles/{id}` (`roles:update`) to rename or change the description. Always send both fields (send the current
description when only renaming):

```json
{ "name": "USER_MANAGER", "description": "Manages users" }
```

`200` → updated `RoleDto`. Errors: `409` "Role name already exists"; `403` "Users cannot change a role they hold";
`404`; `422` blank name.

Permissions: diff old and new selections; send `PUT /api/roles/permissions` for added ids and `DELETE
/api/roles/permissions` for removed ids (`roles:update`):

```json
{ "roleId": 2, "permissionIds": [6, 7] }
```

`204` each. Errors: `403` "Users cannot change a role they hold"; `404` "Role not found" / "Some permissions not found"
(also when a PLATFORM key is sent in a standard tenant); `422` "Permission list cannot be empty" (never send empty).

`DELETE /api/roles/{id}` (`roles:delete`) → `204`. Confirmation: "Delete role USER_MANAGER? It is removed from every user
who has it; they lose its permissions immediately." Errors: `403` held role; `404`.

**Business rules.** Changes apply to every holder on their next request. Predefined roles are ordinary roles: editable
and deletable. After any change, invalidate the roles cache and the permission store.

**Acceptance criteria**
- [ ] A held role is fully read-only with the explanation; a non-held role is editable when the keys allow.
- [ ] Only changed permissions are sent.
- [ ] PLATFORM keys are offered only in the Platform tenant.

---

### Step 16: Permission catalog (read-only)

**Goal / user story.** *As an admin, I want to understand what each permission allows before I put it in a role.*

**Access.** `permissions:read`.

**Route.** `/permissions` (with `?id=` opening a detail drawer for deep links).

**Mockup**

```
+--------------------------------------------------------------------------------+
|  Permissions (fixed catalog - they come with features, nobody creates them)    |
|  Scope: [All v]   Filter [ ______ ]                                            |
|                                                                                |
|  Key                      | Scope    | Description                             |
|  -------------------------+----------+---------------------------------------  |
|  users:read               | TENANT   | List users and find them ...            |
|  users:create             | TENANT   | ...                                     |
|  ...                                                                           |
|  tenants:suspend          | PLATFORM | ...                                     |
+--------------------------------------------------------------------------------+
```

**API calls.** `GET /api/permissions` → array of `PermissionDto` (cache it for the session: it only changes with backend
releases). `GET /api/permissions/{id}` → one `PermissionDto` for the deep-link drawer when the list isn't loaded yet;
`404` "Permission not found".

Standard-tenant admins see PLATFORM keys in the list (the catalog is global); label them "Platform operators only".

**Acceptance criteria**
- [ ] Filter by scope and text; deep link `?id=` opens the drawer.

---

### Step 17: Applications (clients) list and create

**Goal / user story.** *As an admin, I want to register the applications my users log in to and get their `client_id`.*

**Access.** `clients:read` to view; `clients:create` to create.

**Route.** `/applications`; "New application" opens a dialog.

**Mockup**

```
+--------------------------------------------------------------------------------------+
|  Applications                                              [ + New application ]     |
|                                                                                      |
|  Name                | Type               | client_id                 | Status       |
|  --------------------+--------------------+---------------------------+------------  |
|  Management Console  | Management console | <client_id> [Copy]        | Active       |
|  Shop                | Application        | <client_id> [Copy]        | Active       |
|  Partner Portal      | Application        | <client_id> [Copy]        | Suspended    |
+--------------------------------------------------------------------------------------+

+--------------------------------------------+
|  New application                           |
|  Name*  [ Shop                       ]     |
|  Starts with: access tokens 5 min,         |
|  refresh tokens 24 h, claim: username.     |
|  You can change this afterwards.           |
|                   [ Cancel ] [ Create ]    |
+--------------------------------------------+
```

**API calls**

`GET /api/clients` (`clients:read`) → array of `ClientDto` (console included).

`POST /api/clients` (`clients:create`)

```json
{ "name": "Shop" }
```

`201` → `ClientDto` with its generated `client_id`; go to `/applications/:id`.

| Status | Message | UI |
|---|---|---|
| `409` | "Client name already exists" | Under *Name* |
| `400` | "The platform tenant has no application clients, only its management console" | Hide "New application" in the Platform tenant; show the message if it happens |
| `422` | "Client name cannot be null or blank" | Under *Name* |

**Acceptance criteria**
- [ ] `client_id`s are copyable; the console row is visibly different.
- [ ] No "New application" button in the Platform tenant.

---

### Step 18: Application detail (rename, token settings, suspend/activate, delete)

**Goal / user story.** *As an admin, I want to control how long tokens of each application live, whether it gets refresh
tokens, what user details go into its tokens, and to switch it off in an emergency.*

**Access.** `clients:read` to view; `clients:update` to rename and change token settings; `clients:suspend`,
`clients:activate`, `clients:delete` for those actions.

**Route.** `/applications/:id` with tabs *Settings* and *Integrate*.

**Mockup: Settings tab**

```
+-------------------------------------------------------------------------------------+
|  < Applications                                                                     |
|  Shop   [Application] [Active]               [ Rename ] [ Suspend ] [ Delete ]      |
|  client_id: <client_id>  [Copy]                                                     |
|                                                                                     |
|  Token settings  (apply to tokens issued from now on)                    [ Save ]   |
|   Access token lifetime     [  5 ] [minutes v]    1 minute - 1 hour                 |
|   Refresh tokens            [x] Issue refresh tokens                                |
|   Refresh token lifetime    [ 24 ] [hours v]      1 hour - 30 days, longer than     |
|                                                    the access token                 |
|   Claims in the token       [x] username  [ ] email  [ ] full_name                  |
|                             [ ] user_type [ ] tenant_id                             |
|   Always included: iss, sub, aud, client_id, sid, jti, iat, exp.                    |
|   Roles and permissions are never put in tokens.                                    |
+-------------------------------------------------------------------------------------+
```

For the management console: Suspend and Delete are disabled ("The management console can't be suspended/deleted");
renaming and token settings are allowed. Warn when editing the console's settings: "This changes the tokens of
everyone using this console, including you."

**Mockup: Integrate tab** (static, built from data you already have)

```
+-------------------------------------------------------------------------------------+
|  client_id         <client_id>                                         [Copy]       |
|  Token issuer      <IAM base URL>/tenants/<tenantId>                   [Copy]       |
|  JWKS URL          <IAM base URL>/.well-known/jwks.json                [Copy]       |
|  Introspection     POST <IAM base URL>/api/auth/introspect             [Copy]       |
|  Login API         POST <IAM base URL>/api/auth/authenticate           [Copy]       |
|  Forgot password   <auth pages>/<client_id>/forgot-password            [Copy]       |
|  See the Developer guide for verification rules.                                    |
+-------------------------------------------------------------------------------------+
```

**API calls**

`GET /api/clients/{id}` (`clients:read`) → `ClientDto`; `404` "Client not found" → Not found page.

`PUT /api/clients/{id}` (`clients:update`) rename:

```json
{ "name": "Shop (web)" }
```

`200` → `ClientDto`. Errors: `409` "Client name already exists"; `404`; `422` blank name.

`PUT /api/clients/{id}/token-settings` (`clients:update`); always send **all four** fields:

```json
{ "accessTokenTtlSeconds": 300, "refreshTokenEnabled": true, "refreshTokenTtlSeconds": 86400,
  "claims": ["USERNAME", "EMAIL"] }
```

`200` → `ClientDto` with the new settings.

| Status | Message (field) | UI |
|---|---|---|
| `422` | "Access token lifetime must be between 60 and 3600 seconds" (`accessTokenTtlSeconds`) | Under the access field |
| `422` | "Refresh token lifetime must be between 3600 and 2592000 seconds" (`refreshTokenTtlSeconds`) | Under the refresh field |
| `422` | "Refresh tokens must live longer than access tokens" (`refreshTokenOutlivingAccessToken`) | Under the refresh field |
| `422` | "Token claims are required (an empty list for none)" (`claims`) | Bug: always send an array |
| `400` | "Request body is missing or malformed" | Unknown claim name: bug |
| `404` | "Client not found" | Toast |

Client-side validation (Zod), in seconds: access 60-3600; refresh 3600-2592000 **and** greater than access.
**The refresh lifetime is validated even when refresh tokens are switched off**, so keep a valid value in the (disabled)
field. Convert the minute/hour/day units to seconds before sending.

`PUT /api/clients/{id}/suspend` (`clients:suspend`) → `200` `ClientDto` with `"status": "SUSPENDED"`. Confirmation:
"Suspend Shop? Nobody can log in, refresh tokens or reset a password through it, and its current access tokens stop
working at once. Sessions are kept: activating it again restores them." `400` "The management console client can't be
suspended". The call is idempotent.

`PUT /api/clients/{id}/activate` (`clients:activate`) → `200` `ClientDto` `"ACTIVE"`; unexpired sessions work again.

`DELETE /api/clients/{id}` (`clients:delete`) → `204`. Confirmation requires typing the name: "All sessions of this
application end and its client_id stops working forever." `400` "The management console client can't be deleted".

**Business rules.** Token setting changes affect only tokens issued afterwards. Turning refresh tokens off makes refresh
through this client answer `400`; existing users stay logged in only until their access token expires.

**Acceptance criteria**
- [ ] Unit selectors convert correctly; the form blocks invalid combinations before sending.
- [ ] Console: suspend/delete disabled; settings editable with the warning.
- [ ] Suspend and activate update the status badge without a reload.

---
### Phase 3: platform administration

Only for platform users (`GET /api/me` answered `homeTenant.type` = `PLATFORM`, step 8). Platform endpoints are always called **without**
`X-Tenant-Id`. Tenant users get `403` on every `/api/platform/**` call; the console never shows them these pages.

What a platform user may do is decided **per tenant**:

| Who | Tenants list / view | Create tenant | Suspend / activate | Inside a tenant (`X-Tenant-Id`) |
|---|---|---|---|---|
| Platform root | All | Yes | Any standard tenant | Everything |
| Platform user with grants | Tenants where they hold `tenants:read` (empty list without grants) | Only with `tenants:create` granted on **all** tenants | Tenants where they hold `tenants:suspend` / `tenants:activate` | The TENANT keys their grants give on that tenant or on all tenants |

### Step 19: Tenants list

**Goal / user story.** *As a super user, I want to see the tenants I'm responsible for and their status.*

**Access.** Platform users; the list contains only tenants the user holds `tenants:read` on.

**Route.** `/platform/tenants?page=0&size=20`.

**Mockup**

```
+--------------------------------------------------------------------------------------+
|  Tenants                                                       [ + New tenant ]      |
|  Status: [All v]  (filters the current page only)                                    |
|                                                                                      |
|  ID | Name       | Type     | Status     | Actions                                   |
|  ---+------------+----------+------------+------------------------------------------ |
|  1  | Platform   | Platform | Active     | View                                      |
|  3  | Globex     | Standard | Active     | View  |  Act in tenant                    |
|  4  | Initech    | Standard | Suspended  | View  |  Act in tenant                    |
|                                                                                      |
|  Showing 1-3 of 3                                  [< Prev] Page 1 of 1 [Next >]     |
+--------------------------------------------------------------------------------------+
```

**API call.** `GET /api/platform/tenants?page=0&size=20` → paged `TenantDto`s (section 4.4), ordered by id.

| Status | When | UI |
|---|---|---|
| `200` with empty `content` | Platform user without any `tenants:read` grant | Empty state: "You have no tenants to view. Ask the platform root for a grant." Plus "Act in a tenant by id" (step 22). |
| `400` | Bad page/size in URL | Reset paging |
| `403` | Tenant user | Not reachable from the UI |

"New tenant" is shown for the platform root and, optimistically, for others (the server decides, step 20). "Act in
tenant" is not shown on the Platform row.

**Acceptance criteria**
- [ ] Suspended tenants are clearly marked.
- [ ] Empty list for users without grants shows guidance, not an error.

---

### Step 20: Create a tenant (as a super user)

**Goal / user story.** *As a super user, I want to create a tenant for a customer, with its root user, without them going
through public signup.*

**Access.** Platform users holding `tenants:create` on all tenants (the platform root always).

**Route.** `/platform/tenants/new`.

**Mockup.** The signup form of step 5 inside the console layout, titled "New tenant", plus the note "You become the
creator in the audit log. Send the root user their console link and initial password securely." The result page shows
the new tenant, its root user and the console link, like `/signup/done`, with "Copy onboarding message".

**API call: `POST /api/platform/tenants`**, body exactly as signup:

```json
{
  "tenantName": "Initech",
  "rootUser": { "username": "initech-root", "password": "Password1!", "fullName": "Initech Root",
                "email": "root@example.com" }
}
```

`201` → the same `TenantSignupResultDto` as signup (`tenant`, `rootUser`, `managementConsole`).

| Status | Message | UI |
|---|---|---|
| `409` / `400` | "Tenant name not available" / "Username not available" / "Email not available" (`409`); password policy (`400`) | As step 5 |
| `403` | "Do not have permission to perform this operation" | "You need tenants:create on all tenants." |
| `422` | field errors | As step 5 |

**Acceptance criteria**
- [ ] Shares the form component and validation with step 5.
- [ ] After success, the tenants list is invalidated and the new tenant is shown.

---

### Step 21: Tenant detail, suspend and activate

**Goal / user story.** *As a super user, I want to suspend a tenant immediately (for example for abuse or non-payment)
and activate it again later.*

**Access.** Viewing needs `tenants:read` on that tenant; suspending `tenants:suspend`; activating `tenants:activate`.

**Route.** `/platform/tenants/:id`.

**Mockup**

```
+--------------------------------------------------------------------------------+
|  < Tenants                                                                     |
|  Initech  [Standard] [Active]            [ Act in tenant ]   [ Suspend ]       |
|                                                                                |
|  ID       4                                                                    |
|  Type     Standard                                                             |
|  Status   Active                                                               |
|  (Root user, creation date and counts are not available from the API: G-22)   |
+--------------------------------------------------------------------------------+

+-----------------------------------------------------------+
|  Suspend Initech?                                         |
|  - None of its users can log in, refresh tokens or reset  |
|    passwords ("Tenant is suspended").                     |
|  - Their current access tokens stop working at once.      |
|  - Sessions are kept: activating restores them.           |
|  - Platform users can still act inside it.                |
|  Type the tenant name to confirm: [ ________ ]            |
|                          [ Cancel ]  [ Suspend ]          |
+-----------------------------------------------------------+
```

**API calls**

`GET /api/platform/tenants/{id}` → `TenantDto`. `403` (no `tenants:read` on it) → Forbidden panel; `404` "Tenant not
found" → Not found page.

`PUT /api/platform/tenants/{id}/suspend` → `200` `TenantDto` `"SUSPENDED"` (idempotent). `400` "The platform tenant
can't be suspended" (button hidden for Platform); `403` missing `tenants:suspend` on it; `404`.

`PUT /api/platform/tenants/{id}/activate` → `200` `TenantDto` `"ACTIVE"` (idempotent). `403`; `404`.

**Acceptance criteria**
- [ ] No Suspend button on the Platform tenant.
- [ ] The status badge and the list update after the action.

---

### Step 22: Acting inside a tenant (`X-Tenant-Id`)

**Goal / user story.** *As a super user, I want to step into a customer's tenant and use the normal console pages there,
to help them or investigate.*

**Access.** Platform users. What works inside depends on their grants (platform root: everything).

**UI.** The header's "Act in tenant" picker (and the "Act in tenant" buttons of steps 19 and 21).

```
+-------------------------------------------+
|  Act in tenant                            |
|  Search loaded tenants [ glo_          ]  |
|   Globex (#3)          Active             |
|   Initech (#4)         Suspended          |
|   [ Load more ]                           |
|  Or enter a tenant id: [ 42 ] [ Go ]      |
+-------------------------------------------+
```

The options come from `GET /api/platform/tenants` (only tenants with `tenants:read`; the Platform tenant is excluded).
A platform user may hold grants on a tenant without `tenants:read` on it, so the manual id field is needed (gap G-16).

**Behaviour while acting**
1. Store `actingTenant = { id, name? }` in app state (and `sessionStorage`, so a reload keeps it in this tab only).
2. The API client adds `X-Tenant-Id` to tenant-level calls (step 4); query keys include the tenant id; clear the cache on
   enter and exit.
3. Show the banner (step 2) on every page; the Platform nav section shows only "Tenants" (grants are managed from home).
4. Navigation and guards use the **acting** permission set: `GET /api/me` **with** `X-Tenant-Id` (the platform root
   gets every key; others get the TENANT keys their grants give on that tenant or on all tenants). An empty list means
   the user can't do anything there: say so in the banner. Reload it like the home set (step 8).
5. "You hold this role" and "this is you" checks don't apply while acting (you hold no roles in that tenant and you are
   not one of its users).
6. Changing your own password and logging out still act on your own account (no header).

**Errors for every call while acting**

| Status | Message | UI |
|---|---|---|
| `400` | "X-Tenant-Id must be a tenant id" | Bug (we only send numbers) |
| `404` | "Tenant not found" | "Tenant #42 doesn't exist." Exit acting mode |
| `403` | "Do not have permission to perform this operation" | Forbidden panel: "Your grants don't allow this in Globex." |

**Acceptance criteria**
- [ ] Entering and leaving a tenant never shows the other tenant's cached data.
- [ ] The banner is visible on every page while acting.
- [ ] A non-root platform user with a `VIEWER` role grant on tenant 3 sees read-only pages there.

---

### Step 23: Platform users and grants

**Goal / user story.** *As the platform root, I want to create support staff accounts and give each of them exactly the
access they need, on specific tenants or on all tenants.*

**Access.** Platform users **not acting** in a tenant, with `users:read` (view) and `users:update` (change) in the
Platform tenant. Creating platform users uses step 12 (`users:create` + `users:create-management`).

**Routes.** `/platform/users` (list) and `/platform/users/:id/grants`.

**Mockup: `/platform/users`**

```
+--------------------------------------------------------------------------------------+
|  Platform users                                           [ + New platform user ]    |
|  ID | Username   | Full name     | Role grants | Permission grants | Actions         |
|  ---+------------+---------------+-------------+-------------------+---------------- |
|  1  | ops-root   | Platform Root | (root)      | (root)            | -               |
|  2  | alice      | Alice Support | 2           | 1                 | Grants | Access |
+--------------------------------------------------------------------------------------+
```

The list is `GET /api/users` without the header (the Platform tenant's users). "Access" opens the normal access editor
(step 13): roles in the Platform tenant itself. Grant counts load lazily per row (or on the detail page only).
"New platform user" opens `/users/new` with type fixed to Management.

**Mockup: `/platform/users/:id/grants`**

```
+--------------------------------------------------------------------------------------+
|  < Platform users                                                                    |
|  Grants of alice                          (what alice may do inside other tenants)   |
|                                                                                      |
|  Role grants                                                   [ + Grant roles ]     |
|   Role      | Tenant            | Since              |                               |
|   SUPPORT   | Globex (#3)       | 2026-10-25 14:02   | [ Remove ]                    |
|   SUPPORT   | Initech (#4)      | 2026-10-25 14:02   | [ Remove ]                    |
|                                                                                      |
|  Permission grants                                       [ + Grant permissions ]     |
|   Permission     | Tenant         | Since              |                             |
|   tenants:read   | All tenants    | 2026-10-25 14:05   | [ Remove ]                  |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------+
|  Grant roles to alice                            |
|  Roles*   [x] SUPPORT  [ ] ADMIN  [ ] VIEWER      |
|           (Platform tenant roles)                |
|  On       (o) One tenant  [ Globex (#3)     v ]  |
|           ( ) All tenants (also future ones)     |
|                         [ Cancel ]  [ Grant ]    |
+--------------------------------------------------+
```

The permission-grant dialog is the same with a permission picker grouped by resource (any catalog key, including
`tenants:*`). Tenant names in the table come from the tenants list cache; show "#id" when unknown.

**API calls** (all without `X-Tenant-Id`)

`GET /api/platform/users/{userId}/grants` (`users:read` in the Platform tenant) →

```json
{
  "roleGrants": [ { "id": 10, "userId": 2, "roleId": 7, "roleName": "SUPPORT", "tenantId": 3,
                    "createdAt": "2026-10-25T14:02:11.123456Z" } ],
  "permissionGrants": [ { "id": 4, "userId": 2, "permissionId": 18, "permissionName": "tenants:read",
                          "tenantId": null, "createdAt": "2026-10-25T14:05:00Z" } ]
}
```

`tenantId: null` (or missing) means **all tenants**.

`POST /api/platform/grants/roles` (`users:update` in the Platform tenant)

```json
{ "userId": 2, "roleIds": [7], "tenantId": 3 }
```

Leave out `tenantId` for all standard tenants. `201` → array of `RoleGrantDto` (the user's grants of those roles).

`DELETE /api/platform/grants/roles` with the **same body** → `204`; removes those roles' grants on that tenant (without
`tenantId`: the all-tenants grants). Removing one row of the table = this call with that row's `roleId` and `tenantId`.

`POST /api/platform/grants/permissions` / `DELETE /api/platform/grants/permissions`

```json
{ "userId": 2, "permissionIds": [18], "tenantId": null }
```

`201` → array of `PermissionGrantDto` / `204`.

| Status | Message | UI |
|---|---|---|
| `400` | "The platform root already holds every permission on every tenant" | No grant buttons on the root's page |
| `400` | "Grants apply to standard tenants; inside the platform tenant use roles" | The tenant picker never offers Platform |
| `403` | "Users cannot change their own roles or permissions" | No grant buttons on your own page |
| `403` | "Do not have permission to perform this operation" | Called while acting in a tenant, or missing `users:read`/`users:update` |
| `404` | "User not found" | Not a management user of the Platform tenant |
| `404` | "Some roles not found" / "Some permissions not found" / "Tenant not found" | Reload options |
| `422` | "User id is required" / "Role list cannot be empty" / "Permission list cannot be empty" | Bug: validate before sending |

**Business rules.** Grants apply immediately. Requests are all-or-nothing; granting something already granted keeps it;
removing something not granted changes nothing. Grants and removals are audited. PLATFORM keys inside a role take
effect only through grants.

**Acceptance criteria**
- [ ] "All tenants" grants are clearly labelled and explained ("also future tenants").
- [ ] Removing a single row sends exactly that role/permission and tenant.
- [ ] The page refuses to open while acting in a tenant ("Exit the tenant to manage grants").

---

### Phase 4: regular users and app developers

### Step 24: Hosted Auth Pages app (regular users)

**Goal / user story.** *As an end user of a tenant's application, I want a clean page to log in, recover my password and
manage my account.* *As a tenant, I want a link I can give my users.*

**Access.** Public (login, forgot, reset); logged in (account). Any user of the client's tenant.

**Routes.** `/:clientId/login`, `/:clientId/forgot-password`, `/:clientId/reset?identifier=<username or email>`,
`/:clientId/account`.

The pages reuse the components of steps 6, 7 and 9 from `packages/ui` and `packages/iam-client`:

```
 /:clientId/login  --(success)-->  /:clientId/account
        |                                |  [Change password]  [Log out] --> /:clientId/login
        +--> /:clientId/forgot-password --(send code)--> /:clientId/reset --(done)--> /:clientId/login
```

**Mockup: `/:clientId/account`**

```
+------------------------------------------+
|  Your account                            |
|  Signed in as jane (user #42)            |
|                                          |
|  Change password                         |
|  Current  [ ************ ]               |
|  New      [ ************ ]  [policy]     |
|  Confirm  [ ************ ]               |
|                       [ Save ]           |
|                                          |
|  [ Log out ]                             |
+------------------------------------------+
```

**API calls.** `POST /api/auth/authenticate`, `POST /api/auth/token/refresh`, `POST /api/auth/logout`,
`PATCH /api/users/password`, `POST /api/password/reset-request`, `POST /api/password/reset` (all as described in steps
4, 6, 7 and 9).

**Rules and limits today**
- Login through an application client accepts regular **and** management users.
- There's no public endpoint to look up a client's name or validate a `client_id` before submitting (gap G-15), so the
  pages show a neutral title ("Sign in") and learn about a bad `client_id` from the `401` "Unknown client_id" answer.
- After login, stay on the account page; there is no redirect back to the application (gap G-3). Applications log their
  users in themselves (step 25).
- `/:clientId/reset` accepts `?identifier=` to pre-fill the field, so admins (step 11) and later the email link (step 27)
  can point users straight at it. Never accept the OTP in the URL.
- Regular users can't read their own profile (`GET /api/me` is for management users only, gap G-1): show the
  `username` claim when the client includes it, else "user #<sub>".

**Acceptance criteria**
- [ ] The full regular-user journey works end to end against the backend: login, change password, log out, forgot
      password, reset, log in with the new password.
- [ ] A bad `client_id` shows "This application link is not valid" on first submit.
- [ ] Bundle size of the auth app stays small (no console code; target < 200 kB gzipped).

---

### Step 25: Developer guide (JWKS, introspection, login API) in the console

**Goal / user story.** *As a developer of a tenant's application, I want to know how to log users in and verify their
tokens.* Not a CRUD page: a static guide with live values and one optional tool.

**Access.** Any logged-in console user. Route `/developers` (and the Integrate tab of step 18).

**Content to show**

1. **Login from your app**: `POST /api/auth/authenticate` with `{ client_id, username, password }`; refresh with
   `POST /api/auth/token/refresh` `{ client_id, refresh_token }`; refresh tokens are single use (serialize refreshes,
   section 3.5); logout `POST /api/auth/logout` with the Bearer token. Link to `packages/iam-client` usage.
2. **Verify access tokens locally**:
   - fetch `GET /.well-known/jwks.json` (public): `{ "keys": [ { "kty": "RSA", "use": "sig", "alg": "RS256",
     "kid": "...", "n": "...", "e": "AQAB" } ] }`; cache it and refetch when a token names an unknown `kid`;
   - accept only header `"alg": "RS256"` and `"typ": "at+jwt"` (never `none`, never `HS*`);
   - pick the key by `kid`, verify the signature, then check `exp`, `iss` = `<IAM base URL>/tenants/<your tenant id>`,
     and that `aud` contains your `client_id`;
   - a locally verified token stays valid until `exp` even after logout or suspension, so keep access tokens short.
3. **Ask whether a token is active right now**: `POST /api/auth/introspect` `{ "token": "<access token>" }` → always
   `200`: `{ "active": true, "sub", "iss", "aud", "client_id", "sid", "jti", "iat", "exp", "token_type": "Bearer",
   ...the client's claims }` or just `{ "active": false }` (never a reason). Active only while the session is live, the
   user is active and unlocked, and the tenant and client are active. Public today (no client secret, gap G-20).
4. **Authorization** inside the application is the application's own business: the IAM puts no roles or permissions in
   tokens.

**Optional tool: Token inspector** (on the page)

```
+--------------------------------------------------------------------------------+
|  Token inspector                                                               |
|  Paste an access token  [ eyJ...                                           ]   |
|                                         [ Decode ]  [ Check with the IAM ]     |
|  Header:  alg RS256, typ at+jwt, kid key-2026-10  (kid found in JWKS: yes)     |
|  Claims:  sub 42, iss .../tenants/3, aud <client_id>, exp in 3 min ...         |
|  IAM says: active                                                              |
+--------------------------------------------------------------------------------+
```

"Decode" works locally. "Check with the IAM" calls `POST /api/auth/introspect` and `GET /.well-known/jwks.json`.
Warn: "Only paste tokens from test accounts. Nothing is stored." Never persist or log the pasted token.

**Acceptance criteria**
- [ ] All URLs on the page are built from config and the current tenant id, and are copyable.
- [ ] The inspector never stores the token and clears it when leaving the page.

---

### Phase 5: waiting on the backend

These steps are designed now so the UI has a place for them; build them when the backend step ships. Hide them behind
feature flags until then.

### Step 26: Unlock, deactivate and activate users (backend step 12, available)

**Goal.** *As an admin, I want to unlock a user locked out by failed logins, and to switch a user off and on without
deleting them.*

**API.**
- `PUT /api/users/{id}/deactivate` (`users:deactivate`) → `200` with the `UserDto`, `"active": false`. At once the user
  can't log in or refresh (`403`), and their tokens get `401` "Your account is deactivated". Sessions are kept.
- `PUT /api/users/{id}/activate` (`users:activate`) → `200`, `"active": true`; their unexpired sessions work again.
- Both are idempotent. Never yourself (`403` "You can't deactivate, activate or unlock your own account"), never the
  root user (`403` "The root user can't be deactivated, activated or unlocked"), another tenant's user `404`. Hide the buttons on your own
  detail page and on the root's.
- `PUT /api/users/{id}/unlock` (`users:unlock`) → `200` with the `UserDto`: a login lockout ends at once and the count
  of wrong passwords is forgotten; login and the user's tokens work again. Unlocking an unlocked user changes nothing.
  Same rules: never yourself (`403` "You can't deactivate, activate or unlock your own account"), never the root
  (`403` "The root user can't be deactivated, activated or unlocked"; a locked root waits), another tenant's user `404`.
- `lockedUntil` in `UserDto` is the end of a running lock (left out otherwise): show "Locked until <local time>" and
  the "Unlock" button only then.

**UI plan.** User detail (step 11) gets a Status row ("Active", "Locked until 14:35", "Deactivated") and the buttons
"Unlock", "Deactivate"/"Activate"; users list gets a Status column and filter. `UserDto` carries `active`
and `lockedUntil` (gap G-11).

### Step 27: Reset link in admin-initiated reset emails (backend roadmap item 3, planned)

**Goal.** A user whose password an admin reset gets an email with a link to the reset page, not just a code.

**Frontend input needed by the backend (decide together):**
- **Where the link points.** Proposal: the auth app's reset page, `<auth pages>/<client_id>/reset?identifier=<username>`.
  Which `client_id`: a per-client setting such as `password_reset_url`, or a tenant default; for management users the
  console's `/forgot-password/<console_client_id>`.
- **What the link carries.** Proposal: `client_id` + identifier only, the user types the 6-digit code (simple, works
  today). Alternative: a long single-use reset token in the link (then the page reads `?token=`, and the backend needs a
  new reset-by-token endpoint). Never the short OTP in a URL.

**UI plan.** Already covered by step 24's `?identifier=` support. If a token variant is chosen, add a `?token=` branch
that shows only the new-password fields.

### Step 28: Asynchronous templated email and email verification (backend step 13, available)

No new screens. Since backend step 13b:
- forgot-password emails go out right after the request; the answer is the same `200` as before, and a mail failure is
  never visible to the caller. Word the confirmation as "If the account exists, a code is on its way" (it may take a
  few seconds to arrive);
- the admin reset still sends at once and still answers `503` when the email can't be sent (nothing changed then);
- forgot-password timing differences are gone (nothing to change in the UI).

**Email verification (backend step 13c).** A new or changed address starts unverified (`emailVerified:
false` in `UserDto` and `GET /api/me`); only the user can verify it, by typing a code:
- `POST /api/users/email-verification` (any logged-in user, no body) → `204`; the code arrives at their address within
  seconds (valid 30 minutes). `400` "Your email address is already verified", `429` after 3 codes in an hour.
- `POST /api/users/email-verification/confirm` `{ "code": "123456" }` → `204`. `400` "Invalid or expired code" (the
  fifth wrong guess deletes the code: ask for a new one).
- No email is sent on its own (there is no page to link to yet; backend roadmap item 3), so the UI asks: management console
  (step 9, my account) shows "Email not verified · Verify" next to the address and opens a dialog "We sent a code to
  <email>" with a 6-digit field and "Send another code"; user detail (step 11) shows a "Verified" / "Not verified"
  badge (admins can't verify for someone else). Regular users' apps do the same with their user's token.
- Forgot-password emails only verified addresses (the answer stays the same `200`), so prompt users to verify after
  login; say so on the forgot-password page ("We can only send codes to verified email addresses").
- The admin reset still reaches an unverified address, and completing any reset verifies it: after a reset, refresh
  the user's data.

### Step 29: Allowed web origins per application (backend roadmap item 7, planned)

**Goal / user story.** *As a tenant admin, I want to list the web origins of my own single-page app, so that it can call
login, refresh and forgot-password directly from its own domain.*

**Access.** Tenant console with `clients:update` (same as editing the application).

**Route.** `/applications/:id` (a new card on the application detail page of step 18).

**Mockup**

```
+--------------------------------------------------------------+
|  Allowed web origins                                         |
|  Browser apps on these origins may call the IAM directly.    |
|  [ https://app.globex.com                          ] [x]     |
|  [ http://localhost:3000                           ] [x]     |
|  [ + Add origin ]                                            |
|                                              [ Save ]        |
+--------------------------------------------------------------+
```

**API calls.** To be defined by backend roadmap item 7 (likely part of the client update or token-settings body).

**Validation.** Exact origins only: `http` or `https`, host, optional port; no path, trailing slash or `*` (mirror
`^https?://[^/\s?#*]+$`).

**Acceptance criteria**
- [ ] Invalid origins are flagged before saving.
- [ ] The card is hidden for the management console client if the backend decides it has none.

---
## 7. API coverage matrix

Every endpoint the backend exposes today (**51**), the step that uses it, and the permission it needs. "Public" means no
token. "Logged in" means any valid access token. Permissions are checked in the tenant the request works in (your own, or
the `X-Tenant-Id` tenant for platform users).

| # | Method | Path | Used by (step) | Permission |
|---|---|---|---|---|
| 1 | POST | `/api/tenants/signup` | Tenant signup (5) | Public |
| 2 | POST | `/api/auth/authenticate` | Login (6), auth app login (24) | Public |
| 3 | POST | `/api/auth/token/refresh` | API client refresh (4), auth app (24) | Public (valid refresh token) |
| 4 | POST | `/api/auth/logout` | Log out (9), auth app (24) | Logged in |
| 5 | POST | `/api/auth/introspect` | Developer guide token inspector (25); mainly for resource servers | Public |
| 6 | GET | `/.well-known/jwks.json` | Developer guide token inspector (25); mainly for resource servers | Public |
| 7 | POST | `/api/password/reset-request` | Forgot password, screen 1 (7, 24) | Public |
| 8 | POST | `/api/password/reset` | Forgot password, screen 2 (7, 24) | Public |
| 9 | POST | `/api/users` | Create user (12), new platform user (23) | `users:create` (+ `users:create-management` for `MANAGEMENT`) |
| 10 | PATCH | `/api/users/password` | Change password (9, 24) | Logged in (self only) |
| 11 | POST | `/api/users/{id}/password-reset` | User detail: reset password (11) | `users:reset-password` |
| 12 | PUT | `/api/users/roles` | Access editor: add roles (13) | `users:update` |
| 13 | DELETE | `/api/users/roles` | Access editor: remove roles (13) | `users:update` |
| 14 | PUT | `/api/users/permissions` | Access editor: add direct permissions (13) | `users:update` |
| 15 | DELETE | `/api/users/permissions` | Access editor: remove direct permissions (13) | `users:update` |
| 16 | GET | `/api/users` | Users list (10), dashboard count (8), platform users list (23) | `users:read` |
| 17 | GET | `/api/users/{id}` | Bootstrap "me" (8), user detail (11), my account (9) | `users:read` |
| 18 | GET | `/api/users/by-username` | Users list exact lookup (10) | `users:read` |
| 19 | GET | `/api/users/by-email` | Users list exact lookup (10) | `users:read` |
| 20 | DELETE | `/api/users/{id}` | User detail: delete (11) | `users:delete` |
| 21 | GET | `/api/roles` | Bootstrap (8), roles list (14), role names everywhere (10, 11, 13), platform roles for grants (22, 23) | `roles:read` |
| 22 | POST | `/api/roles` | Create role (14) | `roles:create` |
| 23 | GET | `/api/roles/{id}` | Role detail (15) | `roles:read` |
| 24 | GET | `/api/roles/name/{name}` | Create role dialog: name availability hint (14) | `roles:read` |
| 25 | PUT | `/api/roles/{id}` | Role detail: rename/description (15) | `roles:update` (not on a held role) |
| 26 | DELETE | `/api/roles/{id}` | Role detail: delete (15) | `roles:delete` (not on a held role) |
| 27 | PUT | `/api/roles/permissions` | Role detail: add permissions (15) | `roles:update` (not on a held role) |
| 28 | DELETE | `/api/roles/permissions` | Role detail: remove permissions (15) | `roles:update` (not on a held role) |
| 29 | GET | `/api/permissions` | Bootstrap (8), permission pickers (13, 15, 23), catalog (16) | `permissions:read` |
| 30 | GET | `/api/permissions/{id}` | Catalog deep-link drawer (16) | `permissions:read` |
| 31 | GET | `/api/clients` | Applications list (17), dashboard count (8), reset-link helper (11) | `clients:read` |
| 32 | GET | `/api/clients/{id}` | Application detail (18) | `clients:read` |
| 33 | POST | `/api/clients` | Create application (17) | `clients:create` |
| 34 | PUT | `/api/clients/{id}` | Application detail: rename (18) | `clients:update` |
| 35 | PUT | `/api/clients/{id}/token-settings` | Application detail: token settings (18) | `clients:update` |
| 36 | PUT | `/api/clients/{id}/suspend` | Application detail: suspend (18) | `clients:suspend` |
| 37 | PUT | `/api/clients/{id}/activate` | Application detail: activate (18) | `clients:activate` |
| 38 | DELETE | `/api/clients/{id}` | Application detail: delete (18) | `clients:delete` |
| 39 | POST | `/api/platform/tenants` | Create tenant (20) | `tenants:create` on all tenants |
| 40 | GET | `/api/platform/tenants` | Tenants list (19), tenant picker (22, 23) | Platform user; lists tenants with `tenants:read` |
| 41 | GET | `/api/platform/tenants/{id}` | Tenant detail (21) | `tenants:read` on that tenant |
| 42 | PUT | `/api/platform/tenants/{id}/suspend` | Tenant detail: suspend (21) | `tenants:suspend` on that tenant |
| 43 | PUT | `/api/platform/tenants/{id}/activate` | Tenant detail: activate (21) | `tenants:activate` on that tenant |
| 44 | GET | `/api/platform/users/{userId}/grants` | Grants page (23), acting permissions (22) | `users:read` in the Platform tenant |
| 45 | POST | `/api/platform/grants/roles` | Grants page: grant roles (23) | `users:update` in the Platform tenant |
| 46 | DELETE | `/api/platform/grants/roles` | Grants page: remove role grants (23) | `users:update` in the Platform tenant |
| 47 | POST | `/api/platform/grants/permissions` | Grants page: grant permissions (23) | `users:update` in the Platform tenant |
| 48 | DELETE | `/api/platform/grants/permissions` | Grants page: remove permission grants (23) | `users:update` in the Platform tenant |
| 49 | GET | `/api/me` | Bootstrap and navigation (8), my account (9), acting permissions (22) | Logged-in management user (no key; regular users `403`) |
| 50 | PATCH | `/api/users/{id}` | User detail: edit profile (11) | `users:update`; a new email also `users:reset-password` |
| 51 | PATCH | `/api/me` | My account: edit profile (9) | Logged-in management user (no key; a new email needs the current password) |
| 52 | PUT | `/api/users/{id}/deactivate` | User detail: deactivate (26) | `users:deactivate` |
| 53 | PUT | `/api/users/{id}/activate` | User detail: activate (26) | `users:activate` |
| 54 | PUT | `/api/users/{id}/unlock` | User detail: unlock (26) | `users:unlock` |
| 55 | POST | `/api/users/email-verification` | My account: verify email, send code (9, 28) | Logged in (self only) |
| 56 | POST | `/api/users/email-verification/confirm` | My account: verify email, enter code (9, 28) | Logged in (self only) |

Not product endpoints, used only by the team: `/swagger-ui.html` and `/v3/api-docs` (type generation, step 1).

Not product endpoints, for operations only: Spring Boot Actuator under `/actuator` (public, read-only). Every
environment has `/actuator/health` (overall status only; `/health/liveness` and `/health/readiness` for probes) and
`/actuator/info` (build name and version); `dev` adds metrics and applied migrations, `local` more. The console doesn't
use them; a status page could show `/actuator/health` (`200` up, `503` down).

---

## 8. Backend gaps and planned work

### 8.1 Requests to the backend team

Ordered by how much they block the frontend. "Workaround" is what this plan does until the request is done.

| Id | Gap / request | Why the frontend needs it | Workaround today | Priority |
|---|---|---|---|---|
| G-1 | ~~No "current user" endpoint~~ **Done 2026-10-26 for management users:** `GET /api/me` (section 3.9). Still open by decision: regular users get `403`, so the auth app's account page shows only token claims. | Auth app "My account" for regular users. | Token claims | P3 |
| G-2 | ~~CORS is disabled~~ **Fixed 2026-10-26:** allowlist `IAM_CORS_ALLOWEDORIGINS` (section 4.1). | | | Done |
| G-3 | **No OAuth2/OIDC redirect flow** (registered redirect URIs, authorization code + PKCE). | The hosted login can't hand tokens back to applications; each app builds its own login. | Auth app does forgot/reset/account only; apps call the login API themselves | P1 (roadmap 8: OAuth2/OIDC) |
| G-4 | **No machine-readable error codes.** Errors are RFC 9457 problems now (2026-10-27); request a stable `code` property (e.g. `TENANT_SUSPENDED`, `ACCOUNT_LOCKED`, `PASSWORD_EXPIRED`). | The login page must tell six different `403`s apart; today it compares message text. | Message-text matching (fragile) | P1 (roadmap 2) |
| G-5 | **Refresh token only in the JSON body.** Option for an httpOnly, `SameSite=Strict` cookie (or a backend-for-frontend). | Keeps the refresh token away from JavaScript (XSS). | `localStorage` + strict CSP | P2 |
| G-6 | ~~No `expires_in` / `token_type` in the token response~~ **Done 2026-10-26:** login and refresh return both (section 3.1). | | | Done |
| G-7 | ~~`401` has no standard body~~ **Done 2026-10-26:** every `401` is `{ "status": 401, "message": "..." }`, with the reason for a blocked account (section 3.7). | | | Done |
| G-8 | **No way to find a tenant's console without its `client_id`** (e.g. login by organization name or subdomain). | Admins lose their console link. | Personal link, "recent consoles", Console ID field | P2 |
| G-9 | **No search, filter or sort** on users and tenants; no "users holding role X"; roles and clients unpaged. | Large tenants; role impact preview. | Exact lookup by username/email; client-side filtering of the current page | P2 |
| G-10 | ~~Profile update~~ **Done 2026-10-26:** admins `PATCH /api/users/{id}` (step 11), management users their own `PATCH /api/me` (step 9). Regular users can't edit their own profile (by decision, like G-1). | | | Done |
| G-11 | **User status in `UserDto` mostly there.** Done 2026-10-27: `active`, `lockedUntil`, deactivate/activate and unlock. Still missing: created/last-login dates. | Support work ("why can't Jane log in?"). | Not shown | P3 |
| G-12 | ~~Password policy character class quirk~~ **Fixed 2026-10-26:** the specials are exactly `@#!$%^&-+=()`. | | | Done |
| G-13 | **Expired password is a dead end at login** (`403`, and changing a password needs a login). | 90-day expiry locks every user out once. | Send the user to forgot-password | P1 |
| G-14 | **Admin-initiated reset email has no link** (only the code). | The user doesn't know where to enter the code. | Admin copies the reset page link from the UI (step 11) | P1 (roadmap 3) |
| G-15 | **No public client metadata** (`GET /api/clients/public/{client_id}` → name, status, type). | Hosted pages can't show the application name or reject a bad link before submit. | Neutral titles; rely on `401` "Unknown client_id" | P2 |
| G-16 | **Platform users can't discover where they may act.** A grant without `tenants:read` hides the tenant from the list, and reading your own grants needs `users:read` in the Platform tenant. Request `GET /api/platform/me/grants` (or include it in G-1). | Tenant picker and acting permissions. | Manual tenant id entry; optimistic mode | P2 |
| G-17 | ~~A non-root user can delete their own account~~ **Done 2026-10-26:** `DELETE /api/users/{id}` refuses your own account (`403`). A deliberate "delete my account" with the password is backend roadmap item 5 (with self-registration). | | | Done |
| G-18 | **Password-reset endpoints answer `text/plain`**, unlike every other endpoint. | Uniform client. | Text handling for those two calls | P3 |
| G-19 | **No session list or remote sign-out** ("where am I logged in?", "sign out everywhere", admin "end this user's sessions"); no absolute session lifetime. | Security self-service. | Not offered | P2 (roadmap 1) |
| G-20 | **Introspection is public; clients have no secrets.** | Server-side apps should authenticate to introspect. | Documented as is | P2 (with OAuth2/OIDC) |
| G-21 | **No invitations or self-registration** of regular users. | Admins must invent and pass on initial passwords; consumer apps need sign-up. | "Generate password" + copy | P2 (roadmap 4) |
| G-22 | **Thin tenant data:** `TenantDto` has no creation date, root user or counts; tenants can't be renamed or deleted. | Tenant detail page for super users. | Show id, name, type, status only | P3 |
| G-23 | ~~Email sending is synchronous~~ **Done 2026-10-27:** forgot-password emails are sent after the request (backend step 13b); the admin reset stays synchronous and keeps its `503`. | | | Done |
| G-24 | **MFA** (roadmap 6). | Future login step, MFA enrolment page. | Not designed yet | Roadmap |
| G-25 | **Inconsistent user identifiers:** user role/permission assignment takes `username`, platform grants take `userId`. | Small source of bugs. | Typed helpers per endpoint | P3 |
| G-26 | **Allowed origins are platform-wide, not per client.** A tenant's own app on its own domain needs the platform operator to add its origin. | Tenants integrating their own SPAs. | Ask the operator to add the origin | P1 (roadmap 7) |

### 8.2 Planned backend steps that change the frontend

| Backend step | What changes | Frontend step |
|---|---|---|
| Roadmap item 2: links in reset and verification emails | Reset and verification page URLs to agree on | 27, 28 |
| Roadmap item 6: allowed web origins per client | New "Allowed web origins" field on the application | 29 |
| Roadmap: OAuth2/OIDC, MFA, sessions, self-registration, client-scoped users | New login flows and pages | new steps |

### 8.3 Documentation mismatches found while writing this plan

The code wins. All four were fixed on the backend side on 2026-10-26; kept here for history.

| Where | Says | Code does |
|---|---|---|
| OpenAPI summary of `POST /api/users/{id}/password-reset` | "the new password is emailed to that user" | Emails a reset **code**; the old password stops working; the user picks a new password with the code |
| `USER_MANUAL.md` section 9, `404` row | "an unknown username/email on forgot-password" gives `404` | `POST /api/password/reset-request` always answers `200` with the same text |
| `USER_MANUAL.md` section 5 | Special characters `@#!$%^&-+=()` | The regex range makes `-` invalid and `'` `*` valid (G-12) |
| `USER_MANUAL.md` section 9, `401` row | Lists "a locked or deactivated account, a suspended tenant" under `401` | True for **tokens** on protected calls; at **login** these are `403` with a message |

---

## 9. How this document evolves

This plan follows the backend. Every backend step that adds or changes an endpoint, request body, permission key or
rule updates this document **in the same change** as the backend's `docs/USER_MANUAL.md`:

1. Add or change the numbered step(s) in section 6 (new features get the next free number, or go into the right
   phase; never renumber existing steps, so tickets keep pointing at the right place).
2. Add or update the rows in the API coverage matrix (section 7). The matrix must list every endpoint; an endpoint
   without UI use says why.
3. Move solved gaps in section 8 to the changelog below; add new ones with the next `G-` number.
4. Update the "Matches backend as of" line at the top.
5. Add a changelog line.

### Template for a new step

````markdown
### Step N: <page or feature name>

**Goal / user story.** *As a <who>, I want <what>, so that <why>.*

**Access.** <level> with `<permission:key>` (<extra rules>).

**Route.** `<path>`

**Mockup**

```
+-----------------------------------------+
|  <layout>                               |
+-----------------------------------------+
```

**API calls**

`<METHOD> <path>` (`<permission>`)

```json
{ "<exact field>": "<example>" }
```

`<status>` → <response shape>.

| Status | Message | UI |
|---|---|---|
| `<code>` | "<exact backend message>" | <what the UI does> |

**Validation.** <client-side mirror of server rules>

**Business rules.** <rules the UI must respect>

**States.** <loading / empty / error / forbidden>

**Acceptance criteria**
- [ ] <testable statement>
````

### Changelog

| Date | Change |
|---|---|
| 2026-10-26 | First version, matching backend step 11 plus the password-reset fixes (reset codes, user-chosen passwords, 3 codes per hour, admin reset by code). 28 steps, 48 endpoints, gaps G-1 to G-25. |
| 2026-10-26 | G-12 fixed: the password special characters are exactly `@#!$%^&-+=()` (hyphen accepted, `'` and `*` no longer). Section 8.3 mismatches fixed in the backend docs. |
| 2026-10-26 | CORS: section 4.1 rewritten for the backend allowlist `IAM_CORS_ALLOWEDORIGINS` (G-2 fixed, dev proxy optional); new gap G-26 and planned step 29 (per-client allowed origins, backend step 15). |
| 2026-10-26 | `GET /api/me` (management users): section 3.9 rewritten, steps 8, 9 and 22 use it instead of the probe chain, phase 3 detects platform users by `homeTenant.type`, endpoint 49 in the matrix, G-1 done for management users. |
| 2026-10-26 | `PATCH /api/users/{id}` (admin edits another user's name and email): step 11 gets "Edit profile", endpoint 50 in the matrix, G-10 done for admins. Email is required at user creation and signup (the plan said optional): steps 5 and 12 corrected. |
| 2026-10-26 | `PATCH /api/me` (own name and email, current password for an email change): step 9 gets "Edit profile", endpoint 51 in the matrix, G-10 done. |
| 2026-10-26 | Wrong old/current passwords on the account page count like failed logins (lock after 5, then `401`): step 9 error tables. |
| 2026-10-26 | Every `401` has the standard error body; a blocked account's token says why (locked until, deactivated, tenant or client suspended): section 3.7, G-7 done. |
| 2026-10-26 | Login and refresh return `token_type` and `expires_in` and are sent with `Cache-Control: no-store`: sections 3.1 and 3.5, steps 4 and 6, G-6 done. |
| 2026-10-26 | Deleting your own account is refused (`403` "You can't delete your own account"): step 11 error table, G-17 done. |
| 2026-10-26 | The backend has environment profiles (`local` optional, `dev`/`stage`/`prod` strict): section 4.1 says how to run it locally. No API change. |
| 2026-10-26 | Every backend profile, `local` included, now needs the full `.env` (signing key and, until it exists, the platform root too): section 4.1. No API change. |
| 2026-10-26 | The backend roadmap was renumbered by priority: gap references updated (sessions 1, self-registration 2, own-account deletion 3, MFA 4, OAuth2/OIDC 5). |
| 2026-10-27 | Deactivate / activate users (`users:deactivate`, `users:activate`, also in `USER_MANAGER`; `active` in `UserDto`): step 26 API, endpoints 52 and 53, step 11 mockup, sections 1.5, 1.6 and 4.5, G-11 partly done. |
| 2026-10-27 | Unlock users (`users:unlock`, also in `USER_MANAGER`; `lockedUntil` in `UserDto`): step 26 complete on the backend, endpoint 54, sections 1.5, 1.6 and 4.5; G-11 down to created/last-login dates. |
| 2026-10-27 | The backend's emails (the reset code) now have an HTML and a plain-text version and a configured sender (`IAM_MAIL_FROM`, needed in `.env` to run the backend). No API change. |
| 2026-10-27 | Forgot-password emails are sent after the request (backend step 13b); the admin reset keeps its synchronous `503`: step 28, G-23 done, section 8.2. |
| 2026-10-27 | Email verification by code (backend step 13c-1): `emailVerified` in `UserDto` and `GET /api/me`, endpoints 55 and 56, step 28 describes the UI. |
| 2026-10-27 | Forgot-password emails only verified addresses; the admin reset still reaches unverified ones and a completed reset verifies; tokens with `email` carry `email_verified` (backend step 13c-2): step 28, section 3 claims table, section 8.2. |
| 2026-10-27 | Backend plan step 14 (reset link) moved to the backend roadmap as item 2, together with verification links; later roadmap items renumbered (self-registration 3, own-account deletion 4, MFA 5, OAuth2/OIDC 6): step 27, G-14, G-21, G-24, section 8.2. |
| 2026-10-27 | Backend plan step 15 (per-client allowed origins) moved to the backend roadmap as item 6; OAuth2/OIDC is now roadmap 7: step 29, G-3, G-26, section 4.1, section 8.2. The backend plan has no steps left. |
| 2026-10-27 | Errors are RFC 9457 problems (`application/problem+json`, `detail` instead of `message`, every `401` included); "already exists" is `409`; invalid `page`/`size` lists `errors`: sections 3.7, 4.3, 5 (API client), the error tables of the signup, profile, user, role and application steps, G-4, 8.2. New backend roadmap item 2 (stable error codes, G-4); later roadmap items renumbered (self-registration 4, own-account deletion 5, MFA 6, allowed web origins 7, OAuth2/OIDC 8). The backend implementation plan is complete. |
| 2026-10-31 | Spring Boot Actuator: public, read-only `/actuator/health` (with liveness/readiness probes) and `/actuator/info` in every environment, more in `local`/`dev`: noted under the API coverage matrix (section 7). No product API change. |
