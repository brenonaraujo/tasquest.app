# TaskQuest Copilot Instructions

## Architecture Overview

**Two-process app**: Expo (React Native) frontend + Express backend running concurrently.

```
Expo app  →  Express server (:5000)  →  External TaskQuest API (TASKQUEST_API_URL)
```

- The Express server at `server/routes.ts` is a **pure proxy** for all `/api/v1/*` routes — it forwards to the external API preserving auth headers. The only custom endpoint is `POST /api/xp-suggest` (OpenAI-powered XP suggestion).
- `shared/schema.ts` is a Drizzle schema stub; the app does **not** use a local database — all persistence is in the external API.
- The frontend discovers the backend URL from `EXPO_PUBLIC_DOMAIN` (required env var). The Express server discovers the external API from `TASKQUEST_API_URL`.

## Dev Workflow

Run two processes in separate terminals:
```bash
npm run server:dev    # Express proxy on :5000
npm run expo:dev      # Expo bundler (uses REPLIT_DEV_DOMAIN for EXPO_PUBLIC_DOMAIN)
```

Lint: `npm run lint` / `npm run lint:fix`

## API Calls & React Query

All HTTP calls go through helpers in `lib/query-client.ts`:

- **Reads**: React Query with `queryKey: ["/api/v1/resource", id]` — the key segments are joined into a URL automatically by `getQueryFn`.
- **Mutations**: `apiRequest(method, route, body)` — handles auth header and JSON serialization.
- **Auth injection**: Call `setAuthToken(token)` (from `lib/query-client.ts`); all subsequent `apiRequest` and `getQueryFn` calls include `Authorization: Bearer <token>` automatically.

```tsx
// Read pattern
const { data } = useQuery<Task[]>({ queryKey: ["/api/v1/lists", listId, "tasks"] });

// Mutation pattern
await apiRequest("POST", "/api/v1/lists", { name, description });
```

## Authentication

- `lib/auth-context.tsx` manages JWT lifecycle: stored in AsyncStorage under key `taskquest_token`.
- Use `useAuth()` to access `user`, `isAuthenticated`, `login()`, `register()`, `logout()`.
- On app start, auth context restores the token from AsyncStorage and validates via `GET /api/v1/auth/me`.
- After login/register, `queryClient.clear()` is called to purge stale data.

## Navigation Structure

Expo Router file-based routing:

| Route | Presentation |
|---|---|
| `(tabs)/` | 5 persistent tabs (Feed, Lists, Ranking, Alerts, Profile) |
| `(auth)/` | Modal stack (Login, Register) |
| `task/[id]` | Full-screen push |
| `create-task` | `formSheet` (95% height) |
| `create-list` | `formSheet` (50% height) |

The tab bar has **two implementations** in `app/(tabs)/_layout.tsx`: `NativeTabLayout` (iOS Liquid Glass via `expo-glass-effect`) and `ClassicTabLayout` (BlurView fallback). Always maintain both when modifying tabs.

## Types & Theme

- **All types** are in `lib/types.ts`, derived from the external API's OpenAPI spec. Add new types there.
- **Colors**: Always import from `constants/colors.ts` — never use raw hex values in components.
  - `Colors.primary` = cyan `#06B6D4` (XP/actions)
  - `Colors.secondary` = violet `#8B5CF6` (levels)
  - `Colors.accent` = amber `#F59E0B` (energy/stamina)
  - `Colors.background` = `#0F172A`, `Colors.surface` = `#1E293B`
- Task status colors are mapped: `Colors.statusOpen`, `Colors.statusInProgress`, `Colors.statusPendingApproval`, `Colors.statusCompleted`, `Colors.statusCancelled`.

## Server-Side Feed Enrichment

`server/routes.ts` intercepts `/api/v1/feed` responses and enriches feed items that have a `taskId` but are missing `payload.taskTitle` — it fetches task details in parallel and merges them. When modifying feed data shape, account for this enrichment layer.
