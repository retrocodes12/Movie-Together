CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS mt_users (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  rooms_hosted INTEGER DEFAULT 0,
  rooms_joined INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mt_rooms (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  host_id BIGINT REFERENCES mt_users(id) ON DELETE SET NULL,
  previous_host_id BIGINT REFERENCES mt_users(id) ON DELETE SET NULL,
  movie_title TEXT NOT NULL,
  movie_description TEXT DEFAULT '',
  movie_genre TEXT DEFAULT '',
  movie_year INTEGER,
  movie_poster_url TEXT,
  stream_url TEXT DEFAULT '',
  invite_code TEXT UNIQUE NOT NULL,
  max_members INTEGER DEFAULT 10,
  is_public BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'waiting',
  playback_position DOUBLE PRECISION DEFAULT 0,
  playback_state JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mt_room_members (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT REFERENCES mt_rooms(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES mt_users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  is_online BOOLEAN DEFAULT FALSE,
  can_control BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

CREATE TABLE IF NOT EXISTS mt_room_invites (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT REFERENCES mt_rooms(id) ON DELETE CASCADE,
  invited_user_id BIGINT REFERENCES mt_users(id) ON DELETE CASCADE,
  invited_by BIGINT REFERENCES mt_users(id) ON DELETE SET NULL,
  can_control BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, invited_user_id)
);

CREATE TABLE IF NOT EXISTS mt_room_events (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT REFERENCES mt_rooms(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES mt_users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mt_messages (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT REFERENCES mt_rooms(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES mt_users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mt_voice_state (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT REFERENCES mt_rooms(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES mt_users(id) ON DELETE CASCADE,
  is_connected BOOLEAN DEFAULT FALSE,
  is_muted BOOLEAN DEFAULT FALSE,
  is_deafened BOOLEAN DEFAULT FALSE,
  push_to_talk BOOLEAN DEFAULT FALSE,
  is_speaking BOOLEAN DEFAULT FALSE,
  vad_level DOUBLE PRECISION DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

CREATE TABLE IF NOT EXISTS mt_voice_signals (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT REFERENCES mt_rooms(id) ON DELETE CASCADE,
  from_user_id BIGINT REFERENCES mt_users(id) ON DELETE CASCADE,
  target_user_id BIGINT REFERENCES mt_users(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  signal JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mt_discussions (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT REFERENCES mt_rooms(id) ON DELETE CASCADE,
  started_by BIGINT REFERENCES mt_users(id) ON DELETE SET NULL,
  auto_resume BOOLEAN DEFAULT TRUE,
  silence_timeout INTEGER DEFAULT 10,
  status TEXT DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS mt_reactions (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT REFERENCES mt_rooms(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES mt_users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  playback_position DOUBLE PRECISION DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mt_friends (
  id BIGSERIAL PRIMARY KEY,
  requester_id BIGINT REFERENCES mt_users(id) ON DELETE CASCADE,
  addressee_id BIGINT REFERENCES mt_users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);

CREATE TABLE IF NOT EXISTS mt_notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES mt_users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mt_votes (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT REFERENCES mt_rooms(id) ON DELETE CASCADE,
  created_by BIGINT REFERENCES mt_users(id) ON DELETE SET NULL,
  vote_type TEXT NOT NULL,
  label TEXT NOT NULL,
  threshold DOUBLE PRECISION DEFAULT 0.5,
  payload JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN DEFAULT FALSE,
  result TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mt_vote_ballots (
  id BIGSERIAL PRIMARY KEY,
  vote_id BIGINT REFERENCES mt_votes(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES mt_users(id) ON DELETE CASCADE,
  choice TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vote_id, user_id)
);

CREATE TABLE IF NOT EXISTS mt_reviews (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES mt_users(id) ON DELETE CASCADE,
  movie_key TEXT NOT NULL,
  movie_title TEXT NOT NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT DEFAULT '',
  spoiler BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, movie_key)
);

CREATE TABLE IF NOT EXISTS mt_watch_history (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES mt_users(id) ON DELETE CASCADE,
  room_id BIGINT REFERENCES mt_rooms(id) ON DELETE SET NULL,
  movie_key TEXT NOT NULL,
  movie_title TEXT NOT NULL,
  movie_genre TEXT DEFAULT '',
  movie_year INTEGER,
  watch_duration INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  watched_with BIGINT[] DEFAULT '{}',
  watched_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mt_room_members ADD COLUMN IF NOT EXISTS can_control BOOLEAN DEFAULT FALSE;
ALTER TABLE mt_voice_state ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT FALSE;
ALTER TABLE mt_voice_state ADD COLUMN IF NOT EXISTS is_deafened BOOLEAN DEFAULT FALSE;
ALTER TABLE mt_voice_state ADD COLUMN IF NOT EXISTS push_to_talk BOOLEAN DEFAULT FALSE;
ALTER TABLE mt_voice_state ADD COLUMN IF NOT EXISTS vad_level DOUBLE PRECISION DEFAULT 0;

CREATE INDEX IF NOT EXISTS mt_rooms_public_idx ON mt_rooms(is_public, status, created_at DESC);
CREATE INDEX IF NOT EXISTS mt_room_members_room_idx ON mt_room_members(room_id, is_active, last_heartbeat);
CREATE INDEX IF NOT EXISTS mt_room_events_room_idx ON mt_room_events(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mt_reactions_room_idx ON mt_reactions(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mt_notifications_user_idx ON mt_notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS mt_voice_signals_target_idx ON mt_voice_signals(room_id, target_user_id, created_at DESC);
