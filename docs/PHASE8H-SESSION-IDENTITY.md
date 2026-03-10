# Phase 8H — Session Identity Layer

## 1. Session architecture description

The Session Identity Layer provides **deterministic, persistent identity** for Astradio users across browser refreshes and tab reopens, without changing the engine (Render) or pg-store contract.

**Flow:**

1. **Browser** → sends `astradio_session` HTTP-only cookie on every request to the Next.js app (Vercel).
2. **Next.js API** → reads cookie, verifies signature, resolves `userId`.
3. **Engine** → receives `userId` via existing mechanisms (query param for profile, `x-beta-user` for exports/history). No cookie handling on the engine.
4. **pg-store** → unchanged; user lookup by `userId` as today.

**Principles:**

- Identity lives in a **signed HTTP-only cookie** so it cannot be tampered with by client JS.
- Session is **issued once** (on profile creation) and **validated on every** profile/community/export request.
- **No breaking changes**: legacy cookie `astradio_dev_user_id` is still accepted during a transition period; new sessions use the signed cookie only.

---

## 2. Files to modify

| File | Change |
|------|--------|
| `apps/web/src/lib/session.ts` | **New.** Sign/verify session payload, `getSessionUserId(cookies)`, cookie options. |
| `apps/web/app/api/profile/route.ts` | Use `getSessionUserId()`; on POST success set `astradio_session` (signed); on GET 404 clear session cookie; keep PATCH using resolved userId. |
| `apps/web/app/api/user/history/route.ts` | Resolve userId via `getSessionUserId()`, forward as `x-beta-user`. |
| `apps/web/app/api/exports/route.ts` | Resolve userId via `getSessionUserId()`, forward as `x-beta-user`. |

**Not modified:** Engine (vnext/compat/routes.ts), pg-store, community search, audio/compose/export logic, compatibility math, sandbox.

---

## 3. Cookie format

**Name:** `astradio_session`

**Value (opaque to client):**  
`<base64url(JSON payload)>.<signature>`

- **Payload (JSON):** `{ "userId": string, "issuedAt": number }` (issuedAt = Unix ms).
- **Signature:** HMAC-SHA256 of the base64url payload using `ASTRADIO_SESSION_SECRET`, encoded as base64url.

**Options:**

- `HttpOnly: true`
- `Secure: true` when `NODE_ENV === 'production'`
- `SameSite: 'lax'`
- `Path: '/'`
- `Max-Age: 31536000` (1 year, same as current dev cookie)

**Legacy:** `astradio_dev_user_id` — plain userId string. Still read for backward compatibility; not set on new profile creation.

---

## 4. Session validation logic

1. **Read** `astradio_session` from request cookies.
2. **Split** on first `'.'` → `[payloadB64, signature]`.
3. **Verify** `signature === HMAC-SHA256(secret, payloadB64)` (constant-time compare).
4. **Decode** payload from base64url → JSON; validate `userId` (non-empty string) and `issuedAt` (number).
5. **Optional:** reject if `issuedAt` is too old (e.g. > 2 years) to allow future rotation.
6. If any step fails → treat as no session; **fallback** to legacy cookie `astradio_dev_user_id` if present.
7. Return `userId` for the request; otherwise `null`.

---

## 5. Security considerations

- **Secret:** `ASTRADIO_SESSION_SECRET` must be set in Vercel (and Render if engine ever validates sessions). Minimum 32 characters; use a cryptographically random value. Not committed to repo.
- **HttpOnly:** Cookie not readable by client JS; reduces XSS abuse.
- **Secure:** Cookie sent only over HTTPS in production.
- **SameSite=Lax:** Reduces CSRF for same-site flows; cross-site POSTs from other origins do not send the cookie.
- **No PII in cookie:** Only `userId` and `issuedAt`; no email or display name.
- **Tampering:** Forged or modified cookies fail signature verification and are ignored.
- **Incognito:** New incognito window has no cookie → new profile creation → new userId; expected.

---

## 6. Migration strategy (no breaking changes)

1. **Deploy** session layer: new code reads both `astradio_session` (preferred, verified) and `astradio_dev_user_id` (fallback).
2. **New users:** On profile creation, set only `astradio_session` (signed). Do not set legacy cookie for new signups.
3. **Existing users:** Continue to be recognized via `astradio_dev_user_id` until they clear cookies or re-create profile. Optionally, on first request with legacy cookie only, issue a new signed session cookie in the response (migrate-in-place) so subsequent requests use the signed cookie.
4. **Engine:** No change; still receives `userId` from Next.js (query or header).
5. **Future:** After a suitable period, stop reading `astradio_dev_user_id` and remove legacy fallback.
6. **Secret unset:** If `ASTRADIO_SESSION_SECRET` is not set (e.g. existing Vercel env), profile creation still succeeds and sets the legacy cookie only, so no breaking change.

---

## 7. Test plan

| # | Scenario | Steps | Expected |
|---|----------|--------|----------|
| 1 | New profile gets session | Create profile via UI → inspect response Set-Cookie | `astradio_session` present, HttpOnly; body has user.id |
| 2 | GET profile with session | With session cookie → GET /api/profile | 200, user + primaryChart |
| 3 | GET profile no session | No cookie → GET /api/profile | 200, `{ user: null, primaryChart: null }` |
| 4 | Refresh persistence | Create profile → refresh page | Same user loaded (session cookie sent) |
| 5 | Tab reopen | Create profile → close tab → reopen app URL | Same user (cookie persists) |
| 6 | Incognito | Incognito window → create profile | New userId; no cross-session sharing |
| 7 | Tampered cookie | Set cookie to invalid signature → GET /api/profile | Treated as no session (or fallback to legacy if set) |
| 8 | Legacy cookie still works | Only `astradio_dev_user_id` set (existing user) → GET /api/profile | 200, that user’s profile |
| 9 | Exports/history | With session → POST /api/exports, GET /api/user/history | x-beta-user forwarded; engine accepts |
| 10 | PATCH profile | With session → PATCH /api/profile | 200, discoverability updated for resolved user |

---

## Summary

- **Session identity** is implemented in the Next.js app via a signed HTTP-only cookie.
- **Engine and pg-store** are unchanged; they still receive `userId` from the app.
- **Backward compatibility** is preserved via legacy cookie fallback.
- **Security** is improved (signing, HttpOnly, Secure, SameSite) while keeping the same product behavior for users.
