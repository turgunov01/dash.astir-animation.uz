# Astir Admin Dashboard

Nuxt 3 admin dashboard for Astir, a kids streaming and animation platform. The app is built around the backend endpoints from the provided specification and uses runtime configuration for the API base URL.

## Stack

- Nuxt 3 + TypeScript
- Nuxt UI
- Pinia for auth/session state
- zod-powered client-side form validation
- Bearer token API client with normalized legacy and modern API errors

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Set the backend URL in `.env`:

```bash
NUXT_PUBLIC_API_BASE_URL=https://test-api.astir-animation.uz
```

## Backend endpoints

The dashboard expects the Astir backend to expose:

- `/api/v1/auth/login`, `/api/v1/auth/me`, `/api/v1/auth/logout`, `/api/v1/auth/refresh`
- `/api/v1/users`, `/api/v1/children`, `/api/v1/tv-devices`
- `/v1/content/movies`, `/v1/content/categories`, `/api/v1/series`
- `/v1/tariffs`, `/api/v1/billing/subscriptions`, `/api/v1/billing/transactions`
- `/api/v1/cards`, `/api/v1/admin/cards`
- `/api/v1/admin/support/chats`, `/api/v1/admin/faqs`, `/api/v1/faqs`
- `/v1/pairing/sessions`, `/v1/watch-sessions/start`, `/health`

All protected requests attach `Authorization: Bearer <token>`. The API client accepts both modern errors shaped as `{ error: { code, message, requestId } }` and legacy `{ error, message }` responses.
