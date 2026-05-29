# Nuvio Watch Together

Nuvio Watch Together extends Nuvio into a social watch-party platform. Nuvio still owns content discovery, metadata, addon integration, stream retrieval, playback, subtitles, and browsing. Watch Together adds rooms, synchronized playback, voice state/signaling, discussion mode, reactions, friends, invitations, voting, reviews, ratings, and watch history.

## What changed

- Web app entry at `apps/web/src/app/page.jsx`
- Watch Together APIs under `apps/web/src/app/api`
- PostgreSQL schema at `apps/web/database.sql`
- Deploy scripts in `apps/web/package.json`

## Core flow

1. Create profile.
2. Search content through `/api/stremio`.
3. Select existing Nuvio/Stremio stream option.
4. Click `Watch Together`.
5. Room gets invite code and `/join/:code` invite link.
6. Members join, playback syncs from server state.
7. Room voice, discussion mode, live reactions, votes, chat, reviews, and history use Watch Together APIs.

## Systems reused

- Search/discovery: `/api/stremio?query=...`
- Metadata: Stremio `meta` resources
- Addons: Stremio manifests and catalogs
- Stream resolution: Stremio `stream` resources
- Playback: browser video/player surface, no replacement media platform
- Subtitles/stream hints: preserved in selected stream metadata

## Watch Together API map

- `GET/POST /api/profile`
- `GET/POST /api/rooms`
- `GET/PUT/DELETE /api/rooms/:id`
- `POST /api/rooms/:id/join`
- `POST /api/rooms/:id/leave`
- `POST /api/rooms/:id/heartbeat`
- `GET /api/rooms/:id/stream`
- `POST /api/rooms/:id/playback`
- `GET/POST /api/rooms/:id/voice`
- `GET/POST /api/rooms/:id/discussion`
- `GET/POST /api/rooms/:id/messages`
- `GET/POST /api/reactions`
- `GET/POST/PUT /api/votes`
- `GET/POST/PUT/DELETE /api/reviews`
- `GET/POST /api/watchhistory`
- `GET/POST /api/friends`
- `GET/PUT/DELETE /api/notifications`

## Database

Use any PostgreSQL provider reachable from serverless/server deployments. Neon is already supported through `@neondatabase/serverless`.

```bash
psql "$DATABASE_URL" -f apps/web/database.sql
```

Required env:

```bash
DATABASE_URL=postgres://...
```

Optional env:

```bash
AUTH_SECRET=...
AUTH_URL=https://your-domain.example
```

## Local development

```bash
cd apps/web
npm install
npm run dev
```

Open `http://localhost:5173`.

## Build and run

```bash
cd apps/web
npm run build
npm run start
```

## Vercel deploy

Set project root to `apps/web`.

Build command:

```bash
npm run build
```

Install command:

```bash
npm install
```

Output is handled by React Router server build. Add `DATABASE_URL` in Vercel environment variables and run `apps/web/database.sql` once against that database.

## Render deploy

Use a Web Service.

Root directory:

```text
apps/web
```

Build command:

```bash
npm install && npm run build
```

Start command:

```bash
npm run start
```

Add `DATABASE_URL` in Render environment variables and run `apps/web/database.sql` once.

## Other services

Any Node host works if it can run:

```bash
npm install
npm run build
npm run start
```

Use Node 20+ and provide `DATABASE_URL`.

## Room behavior

- Public rooms appear in public room list.
- Private rooms require invite code or host-created invite grant.
- Host can give selected invited members playback control.
- Leaving a room marks only that member inactive.
- Host leaving migrates host to another active member when possible and never ends playback by itself.
- Heartbeats keep presence current and trigger host migration for stale hosts.

## Sync model

Playback commands write to `mt_rooms.playback_state`. Clients poll/SSE room snapshots and reconcile local video position. Server state is authoritative. Drift correction seeks when client position differs by more than client threshold; target drift is under 100ms, maximum tolerated drift is 500ms.

## Voice model

`/api/rooms/:id/voice` stores room voice state and WebRTC signaling payloads:

- connected/disconnected
- mute/unmute
- deafen/undeafen
- push-to-talk
- speaking indicators
- VAD level
- offer/answer/ICE signaling payload storage

Production voice media should use WebRTC peer connections or an SFU using this signaling surface. Serverless hosts do not relay raw audio.

## Legal

This app is an interface for user-provided or user-installed sources. It does not host, store, or distribute media content.
