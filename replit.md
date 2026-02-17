# TaskQuest - Social Gamified To-Do App

## Overview
TaskQuest is a mobile-first social gamified to-do list app built with React Native (Expo) and Express. It connects to an external TaskQuest API for data persistence while using an Express proxy server for API routing and AI-powered XP suggestions.

## Architecture
- **Frontend**: Expo Router (file-based routing), React Native, TypeScript
- **Backend**: Express server (port 5000) that proxies requests to external TaskQuest API
- **External API**: TaskQuest API at `TASKQUEST_API_URL` (default: http://localhost:3000)
- **AI**: OpenAI integration for intelligent XP suggestions on task creation
- **Auth**: JWT-based auth stored in AsyncStorage with Bearer token headers

## Key Files
- `lib/auth-context.tsx` - Auth context with JWT token management
- `lib/query-client.ts` - React Query client with auth header injection
- `lib/types.ts` - TypeScript types matching OpenAPI spec
- `server/routes.ts` - Express proxy to TaskQuest API + XP suggestion endpoint
- `constants/colors.ts` - Dark gaming theme (emerald/violet/amber)
- `components/TaskCard.tsx` - Task card with status badges and XP
- `components/FeedItemCard.tsx` - Activity feed item
- `components/XPBar.tsx` - XP progress bar with level/energy

## Navigation Structure
- `(tabs)/` - 5 tabs: Feed, Lists, Ranking, Alerts, Profile
- `(auth)/` - Modal auth flow: Login, Register
- `list/[id]` - List detail with tasks
- `task/[id]` - Task detail with subtasks, comments, actions
- `create-task` - Form sheet for task creation (with AI XP suggestion)
- `create-list` - Form sheet for list creation

## Design
- Dark theme: #0F172A background, #1E293B surfaces
- Primary: #10B981 (emerald) for XP/success
- Secondary: #8B5CF6 (violet) for levels/prestige
- Accent: #F59E0B (amber) for energy/stamina
- Font: Inter (400, 500, 600, 700)

## API Proxy
Express proxies `/api/v1/*` to external TaskQuest API at `TASKQUEST_API_URL`.
XP suggestion endpoint: `POST /api/xp-suggest` (uses OpenAI)

## Environment Variables
- `TASKQUEST_API_URL` - External TaskQuest API base URL
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key (via Replit integration)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI base URL (via Replit integration)

## Recent Changes
- Feb 2026: Initial build with full feature set
  - JWT auth flow (login/register)
  - 5-tab navigation with liquid glass support
  - Feed, Lists, Leaderboard, Notifications, Profile screens
  - List detail, Task detail with comments/voting
  - Create task with AI XP suggestions
  - Create list form sheet
  - Express proxy to TaskQuest API
