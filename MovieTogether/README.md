# Nuvio Watch Together

This project now uses the Nuvio codebase as the media foundation and extends it with Watch Together social rooms.

Nuvio remains responsible for content discovery, search, metadata, addon ecosystem support, stream retrieval, stream selection, playback, subtitles, and browsing. Watch Together adds rooms, synchronization, voice state/signaling, discussion mode, reactions, friends, invitations, voting, watch history, reviews, ratings, and notifications.

## Apps

- `apps/nuvio` - Nuvio web app with Watch Together buttons and player sync layer.
- `apps/web` - Watch Together API/backend for rooms, social data, sync state, voice signaling, and invites.
- `apps/mobile` - mobile social shell. Custom media discovery was removed; content discovery and playback happen in Nuvio.

## Removed

The old custom Stremio backend endpoint was removed:

```text
apps/web/src/app/api/stremio/route.js
```

Do not rebuild it. Nuvio handles addon discovery, metadata, stream resolution, stream selection, playback, and subtitle behavior.

## Watch Together Flow

1. User discovers content in Nuvio.
2. User selects stream through Nuvio's existing stream UI.
3. User clicks `Watch Together`.
4. Backend creates room, invite code, and invite link.
5. Nuvio opens existing player with room metadata.
6. Sync layer controls Nuvio's player instead of replacing it.
7. Friends join room through invite link/code.
8. Playback, discussion mode, reactions, voice state, and votes sync through backend APIs.

## Frontend Integration

Watch Together entry points were added to Nuvio:

- content detail page: `Watch Together` button next to play action
- stream selection page: `Watch Together` button per stream
- player page: room panel with invite, discussion, mute, reactions, and member list

Relevant files:

- `apps/nuvio/js/core/watchTogether/watchTogetherClient.js`
- `apps/nuvio/js/core/watchTogether/watchTogetherSync.js`
- `apps/nuvio/js/ui/screens/detail/metaDetailsScreen.js`
- `apps/nuvio/js/ui/screens/stream/streamScreen.js`
- `apps/nuvio/js/ui/screens/player/playerScreen.js`
- `apps/nuvio/css/components.css`

## Backend API

Watch Together APIs live under `apps/web/src/app/api`:

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

PostgreSQL schema:

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
AUTH_URL=https://your-backend.example
```

## Configure Nuvio

Set Watch Together backend URL in `apps/nuvio/nuvio.env.js`:

```js
(function defineNuvioEnv() {
  var root = typeof globalThis !== "undefined" ? globalThis : window;
  root.__NUVIO_ENV__ = {
    WATCH_TOGETHER_API_BASE_URL: "https://your-backend.example"
  };
}());
```

If Nuvio and backend share one origin, leave `WATCH_TOGETHER_API_BASE_URL` empty.

## Local Development

Backend:

```bash
cd apps/web
npm install
npm run dev
```

Nuvio:

```bash
cd apps/nuvio
npm install
npm run build
npm run serve
```

Open Nuvio, configure backend URL if needed, browse content, select stream, then create Watch Together room.

## Production Build

Backend:

```bash
cd apps/web
npm install
npm run build
npm run start
```

Nuvio static app:

```bash
cd apps/nuvio
npm install
npm run build
```

Deploy `apps/nuvio/dist` to static hosting.

## Vercel

Recommended split deployment:

1. Deploy `apps/web` as backend project.
2. Add `DATABASE_URL`.
3. Run `apps/web/database.sql` once against the database.
4. Deploy `apps/nuvio/dist` as static frontend.
5. Set `WATCH_TOGETHER_API_BASE_URL` to backend URL in Nuvio env file before build, or serve a runtime `nuvio.env.js`.

## Render

Backend Web Service:

```text
Root directory: apps/web
Build command: npm install && npm run build
Start command: npm run start
```

Static Nuvio site:

```text
Root directory: apps/nuvio
Build command: npm install && npm run build
Publish directory: dist
```

## Sync Model

Playback state is server authoritative. Nuvio's player sends play, pause, seek, skip, episode change, and content change events to backend. Clients poll room snapshots, compare local media time against authoritative state, then auto-correct drift.

Targets:

- ideal drift under 100ms
- maximum tolerated drift 500ms
- host leaving does not end room
- host migration selects another active member
- private rooms can grant playback control to selected members

## Voice Model

Voice chat uses room voice state plus signaling payloads:

- join/leave voice channel
- mute/unmute
- deafen/undeafen state
- push-to-talk state
- speaking indicators
- VAD level fields
- WebRTC offer/answer/ICE payload storage
- reconnection through repeated heartbeat and voice state refresh

For production audio routing, connect browser WebRTC peer connections or an SFU to `/api/rooms/:id/voice`. Serverless deployments should not relay raw audio through HTTP.

## Legal

This app does not host, store, or distribute media content. User content discovery, addons, streams, and playback are handled by Nuvio and user-configured sources.
