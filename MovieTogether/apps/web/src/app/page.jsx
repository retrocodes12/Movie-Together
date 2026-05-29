"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Copy,
  Crown,
  Film,
  Heart,
  Link2,
  Mic,
  MicOff,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  SkipBack,
  SkipForward,
  Users,
  Vote,
} from "lucide-react";

const REACTIONS = ["😂", "😱", "🔥", "❤️", "😭", "👏"];
const API_HEADERS = { "Content-Type": "application/json" };

function deviceId() {
  if (typeof window === "undefined") return "server";
  const key = "nuvio_watch_together_device";
  let value = localStorage.getItem(key);
  if (!value) {
    value = `web_${crypto.randomUUID()}`;
    localStorage.setItem(key, value);
  }
  return value;
}

async function api(path, options = {}) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function roomInviteUrl(room) {
  if (typeof window === "undefined" || !room?.invite_code) return "";
  return `${window.location.origin}/join/${room.invite_code}`;
}

export default function Page() {
  const [did, setDid] = useState("");
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({ display_name: "", username: "" });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [streams, setStreams] = useState([]);
  const [selectedStream, setSelectedStream] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [friends, setFriends] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [voice, setVoice] = useState({ muted: false, deafened: false, push_to_talk: false, speaking: false });
  const [voiceStates, setVoiceStates] = useState([]);
  const [discussion, setDiscussion] = useState(null);
  const [votes, setVotes] = useState([]);
  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState("");
  const [flying, setFlying] = useState([]);
  const videoRef = useRef(null);
  const reactionSince = useRef(new Date().toISOString());
  const pollRef = useRef(null);

  const currentMember = room?.members?.find((m) => m.user_id === profile?.id);
  const canControl = !!room && (room.host_id === profile?.id || currentMember?.can_control);

  const showToast = useCallback((text) => {
    setToast(text);
    setTimeout(() => setToast(""), 2500);
  }, []);

  const loadProfile = useCallback(async (id) => {
    const data = await api(`/api/profile?device_id=${encodeURIComponent(id)}`);
    setProfile(data.user);
  }, []);

  useEffect(() => {
    const id = deviceId();
    setDid(id);
    loadProfile(id).catch(() => {});
    api("/api/rooms").then((d) => setRooms(d.rooms || [])).catch(() => {});
  }, [loadProfile]);

  const refreshSideData = useCallback(async () => {
    if (!did || !profile) return;
    const settled = await Promise.allSettled([
      api(`/api/friends?device_id=${encodeURIComponent(did)}`),
      api(`/api/notifications?device_id=${encodeURIComponent(did)}&limit=20`),
      api(`/api/watchhistory?device_id=${encodeURIComponent(did)}&limit=8`),
    ]);
    if (settled[0].status === "fulfilled") setFriends(settled[0].value.friends || []);
    if (settled[1].status === "fulfilled") setNotifications(settled[1].value.notifications || []);
    if (settled[2].status === "fulfilled") setHistory(settled[2].value.history || []);
  }, [did, profile]);

  useEffect(() => {
    refreshSideData();
  }, [refreshSideData]);

  const search = async () => {
    if (query.trim().length < 2) return;
    setLoading("search");
    try {
      const data = await api(`/api/stremio?query=${encodeURIComponent(query)}&type=movie`);
      setResults(data.results || []);
    } catch (e) {
      showToast(e.message);
    } finally {
      setLoading("");
    }
  };

  const selectContent = async (item) => {
    setSelected(item);
    setStreams([]);
    setSelectedStream(null);
    setLoading("streams");
    try {
      const data = await api(`/api/stremio?action=streams&type=${encodeURIComponent(item.type || "movie")}&id=${encodeURIComponent(item.id)}`);
      setStreams(data.streams || []);
      setSelectedStream((data.streams || []).find((s) => s.playable) || data.streams?.[0] || null);
    } catch (e) {
      showToast(e.message);
    } finally {
      setLoading("");
    }
  };

  const saveProfile = async () => {
    if (!profileForm.display_name.trim() || !profileForm.username.trim()) return;
    setLoading("profile");
    try {
      const data = await api("/api/profile", {
        method: "POST",
        headers: API_HEADERS,
        body: JSON.stringify({
          device_id: did,
          display_name: profileForm.display_name.trim(),
          username: profileForm.username.trim().toLowerCase(),
          avatar_url: "🎬",
        }),
      });
      setProfile(data.user);
    } catch (e) {
      showToast(e.message);
    } finally {
      setLoading("");
    }
  };

  const createRoom = async (isPublic = false) => {
    if (!profile || !selected) return showToast("Create profile and select content first");
    setLoading("room");
    try {
      const stream = selectedStream || streams.find((s) => s.playable) || streams[0];
      const data = await api("/api/rooms", {
        method: "POST",
        headers: API_HEADERS,
        body: JSON.stringify({
          device_id: did,
          name: `${selected.name} watch party`,
          movie_title: selected.name,
          movie_description: selected.description,
          movie_genre: (selected.genres || []).join(", "),
          movie_year: Number.parseInt(selected.year, 10) || null,
          movie_poster_url: selected.poster,
          stream_url: stream?.url || "",
          selected_stream: stream,
          content_type: selected.type || "movie",
          content_id: selected.id,
          max_members: 12,
          is_public: isPublic,
        }),
      });
      await joinRoom(data.room, data.room.invite_code);
      showToast("Room created");
    } catch (e) {
      showToast(e.message);
    } finally {
      setLoading("");
    }
  };

  const joinRoom = async (targetRoom, code = "") => {
    if (!profile) return showToast("Create profile first");
    const data = await api(`/api/rooms/${targetRoom.id}/join`, {
      method: "POST",
      headers: API_HEADERS,
      body: JSON.stringify({ device_id: did, invite_code: code || targetRoom.invite_code }),
    });
    setRoom(data.room);
  };

  const refreshRoom = useCallback(async () => {
    if (!room) return;
    const [snapshot, msgs, voiceData, disc, voteData] = await Promise.allSettled([
      api(`/api/rooms/${room.id}`),
      api(`/api/rooms/${room.id}/messages`),
      api(`/api/rooms/${room.id}/voice?since=${encodeURIComponent(new Date(Date.now() - 10000).toISOString())}`),
      api(`/api/rooms/${room.id}/discussion?device_id=${encodeURIComponent(did)}`),
      api(`/api/votes?room_id=${room.id}&device_id=${encodeURIComponent(did)}`),
    ]);
    if (snapshot.status === "fulfilled") setRoom(snapshot.value.room);
    if (msgs.status === "fulfilled") setMessages(msgs.value.messages || []);
    if (voiceData.status === "fulfilled") setVoiceStates(voiceData.value.voice_states || []);
    if (disc.status === "fulfilled") setDiscussion(disc.value.discussion);
    if (voteData.status === "fulfilled") setVotes(voteData.value.votes || []);
  }, [room, did]);

  useEffect(() => {
    if (!room) return;
    refreshRoom();
    pollRef.current = setInterval(refreshRoom, 2000);
    return () => clearInterval(pollRef.current);
  }, [room?.id, refreshRoom]);

  useEffect(() => {
    if (!room || !did) return;
    const t = setInterval(() => {
      api(`/api/rooms/${room.id}/heartbeat`, {
        method: "POST",
        headers: API_HEADERS,
        body: JSON.stringify({ device_id: did }),
      }).catch(() => {});
    }, 8000);
    return () => clearInterval(t);
  }, [room?.id, did]);

  useEffect(() => {
    if (!room || !did) return;
    api(`/api/rooms/${room.id}/voice`, {
      method: "POST",
      headers: API_HEADERS,
      body: JSON.stringify({ device_id: did, ...voice }),
    }).catch(() => {});
  }, [room?.id, did, voice]);

  useEffect(() => {
    if (!room) return;
    const t = setInterval(async () => {
      try {
        const data = await api(`/api/reactions?room_id=${room.id}&since=${encodeURIComponent(reactionSince.current)}`);
        reactionSince.current = data.server_time || new Date().toISOString();
        (data.reactions || []).forEach((r) => addFlying(r.emoji));
      } catch {}
    }, 2500);
    return () => clearInterval(t);
  }, [room?.id]);

  const playback = room?.playback_state || {};

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !room) return;
    const pos = Number(playback.position || 0);
    if (Number.isFinite(pos) && Math.abs(video.currentTime - pos) > 0.5) video.currentTime = pos;
    if (playback.status === "playing" && video.paused) video.play().catch(() => {});
    if (playback.status !== "playing" && !video.paused) video.pause();
  }, [room?.id, playback.status, playback.position, playback.content_url]);

  const sendPlayback = async (event, payload = {}) => {
    if (!room || !canControl) return;
    const pos = videoRef.current?.currentTime || playback.position || 0;
    await api(`/api/rooms/${room.id}/playback`, {
      method: "POST",
      headers: API_HEADERS,
      body: JSON.stringify({ device_id: did, event, payload: { position: pos, ...payload } }),
    });
    refreshRoom();
  };

  const startDiscussion = async () => {
    if (!room) return;
    await api(`/api/rooms/${room.id}/discussion`, {
      method: "POST",
      headers: API_HEADERS,
      body: JSON.stringify({ device_id: did, action: "start", silence_timeout: 10, auto_resume: true }),
    });
    refreshRoom();
  };

  const endDiscussion = async () => {
    if (!room) return;
    await api(`/api/rooms/${room.id}/discussion`, {
      method: "POST",
      headers: API_HEADERS,
      body: JSON.stringify({ device_id: did, action: "end" }),
    });
    refreshRoom();
  };

  const addFlying = (emoji) => {
    const id = `${Date.now()}_${Math.random()}`;
    setFlying((items) => [...items.slice(-10), { id, emoji, left: 20 + Math.random() * 70 }]);
    setTimeout(() => setFlying((items) => items.filter((x) => x.id !== id)), 2200);
  };

  const react = async (emoji) => {
    if (!room) return;
    addFlying(emoji);
    await api("/api/reactions", {
      method: "POST",
      headers: API_HEADERS,
      body: JSON.stringify({ device_id: did, room_id: room.id, emoji, playback_position: videoRef.current?.currentTime || 0 }),
    }).catch((e) => showToast(e.message));
  };

  const sendMessage = async () => {
    if (!room || !message.trim()) return;
    await api(`/api/rooms/${room.id}/messages`, {
      method: "POST",
      headers: API_HEADERS,
      body: JSON.stringify({ device_id: did, message }),
    });
    setMessage("");
    refreshRoom();
  };

  const createVote = async (vote_type, label) => {
    if (!room) return;
    await api("/api/votes", {
      method: "POST",
      headers: API_HEADERS,
      body: JSON.stringify({ device_id: did, room_id: room.id, vote_type, label, threshold: 0.5, duration_s: 60 }),
    });
    refreshRoom();
  };

  const roomStream = playback.content_url || room?.stream_url || "";
  const invite = useMemo(() => roomInviteUrl(room), [room]);

  return (
    <main className="min-h-screen bg-[#0b0d10] text-[#f6f3ed]">
      {toast && <div className="fixed right-4 top-4 z-50 rounded-md border border-[#35383d] bg-[#171a1f] px-4 py-3 text-sm">{toast}</div>}
      <header className="sticky top-0 z-30 border-b border-[#25282d] bg-[#0b0d10]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Film className="h-6 w-6 text-[#f35b45]" />
            <div>
              <h1 className="text-lg font-semibold leading-none">Nuvio Watch Together</h1>
              <p className="text-xs text-[#8d949e]">Discord + Stremio + Netflix Party</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#aab1bb]">
            <Bell className="h-4 w-4" />
            {notifications.filter((n) => !n.read).length} unread
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[320px_1fr_340px]">
        <aside className="space-y-4">
          {!profile ? (
            <section className="panel">
              <h2 className="panel-title">Profile</h2>
              <input className="field" placeholder="Display name" value={profileForm.display_name} onChange={(e) => setProfileForm((s) => ({ ...s, display_name: e.target.value }))} />
              <input className="field" placeholder="Username" value={profileForm.username} onChange={(e) => setProfileForm((s) => ({ ...s, username: e.target.value }))} />
              <button className="primary-btn w-full" onClick={saveProfile} disabled={loading === "profile"}>Create profile</button>
            </section>
          ) : (
            <section className="panel">
              <h2 className="panel-title">Signed in</h2>
              <p className="text-sm">{profile.display_name}</p>
              <p className="text-xs text-[#8d949e]">@{profile.username}</p>
            </section>
          )}

          <section className="panel">
            <h2 className="panel-title">Discover</h2>
            <div className="flex gap-2">
              <input className="field" placeholder="Search Nuvio/Stremio" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
              <button className="icon-btn" onClick={search}><Search className="h-4 w-4" /></button>
            </div>
            <div className="mt-3 max-h-[520px] space-y-2 overflow-auto">
              {results.map((item) => (
                <button key={`${item.type}:${item.id}`} className={`result ${selected?.id === item.id ? "result-active" : ""}`} onClick={() => selectContent(item)}>
                  {item.poster && <img src={item.poster} alt="" className="h-16 w-11 rounded object-cover" />}
                  <span className="min-w-0 text-left">
                    <span className="block truncate text-sm font-medium">{item.name}</span>
                    <span className="block truncate text-xs text-[#8d949e]">{item.year || item.type} {item.addon?.name ? `• ${item.addon.name}` : ""}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="space-y-4">
          <div className="relative overflow-hidden rounded-lg border border-[#25282d] bg-black">
            {roomStream ? (
              <video ref={videoRef} className="aspect-video w-full bg-black" src={roomStream} controls={canControl} playsInline />
            ) : (
              <div className="flex aspect-video items-center justify-center text-[#8d949e]">Select content, choose stream, create room</div>
            )}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {flying.map((r) => <span key={r.id} className="reaction-fly" style={{ left: `${r.left}%` }}>{r.emoji}</span>)}
            </div>
          </div>

          <div className="panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold">{room?.movie_title || selected?.name || "No session selected"}</h2>
                <p className="text-sm text-[#8d949e]">
                  {room ? `${room.name} • ${room.is_public ? "Public" : "Private"} • ${room.members?.length || 0}/${room.max_members} members` : "Nuvio handles search, metadata, addons, streams, subtitles, playback. Watch Together wraps sync and social."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="secondary-btn" onClick={() => selectedStream?.url && window.open(selectedStream.url, "_blank")} disabled={!selectedStream?.url}><Play className="h-4 w-4" /> Play</button>
                <button className="primary-btn" onClick={() => createRoom(false)} disabled={!selected || loading === "room"}><Users className="h-4 w-4" /> Watch Together</button>
                <button className="secondary-btn" onClick={() => showToast("Library hook ready for Nuvio account storage")}><Plus className="h-4 w-4" /> Add to Library</button>
              </div>
            </div>

            {streams.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-[#8d949e]">Nuvio stream options</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {streams.slice(0, 8).map((s, idx) => (
                    <button key={`${s.source}_${idx}_${s.url}`} className={`stream ${selectedStream === s ? "stream-active" : ""}`} onClick={() => setSelectedStream(s)}>
                      <span className="truncate font-medium">{s.name || s.source}</span>
                      <span className="text-xs text-[#8d949e]">{s.quality} • {s.streamType} • {s.playable ? "room playable" : "external"}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {room && (
            <div className="panel">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="panel-title">Playback sync</h2>
                  <p className="text-xs text-[#8d949e]">Server authoritative. Guests auto-follow. Host can delegate controls in private rooms.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="icon-btn" disabled={!canControl} onClick={() => sendPlayback("SKIP_BACKWARD", { seconds: 10 })}><SkipBack className="h-4 w-4" /></button>
                  <button className="icon-btn" disabled={!canControl} onClick={() => sendPlayback("PLAY")}><Play className="h-4 w-4" /></button>
                  <button className="icon-btn" disabled={!canControl} onClick={() => sendPlayback("PAUSE")}><Pause className="h-4 w-4" /></button>
                  <button className="icon-btn" disabled={!canControl} onClick={() => sendPlayback("SKIP_FORWARD", { seconds: 10 })}><SkipForward className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {REACTIONS.map((emoji) => <button key={emoji} className="emoji-btn" onClick={() => react(emoji)}>{emoji}</button>)}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="secondary-btn" onClick={startDiscussion}>Start discussion</button>
                <button className="secondary-btn" onClick={endDiscussion}>End discussion</button>
                <button className="secondary-btn" onClick={() => createVote("resume", "Resume playback")}><Vote className="h-4 w-4" /> Vote resume</button>
                <button className="secondary-btn" onClick={() => createVote("skip_intro", "Skip intro")}><Vote className="h-4 w-4" /> Vote skip</button>
              </div>
              {discussion && <p className="mt-3 rounded-md bg-[#31251a] px-3 py-2 text-sm text-[#ffd39b]">Discussion active. Playback paused until silence timeout or manual resume.</p>}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          {room && (
            <section className="panel">
              <h2 className="panel-title">Room</h2>
              <div className="rounded-md bg-[#111419] p-3">
                <p className="text-xs text-[#8d949e]">Invite code</p>
                <p className="text-2xl font-semibold tracking-[0.22em] text-[#f35b45]">{room.invite_code}</p>
              </div>
              <div className="mt-2 flex gap-2">
                <button className="secondary-btn flex-1" onClick={() => navigator.clipboard.writeText(invite).then(() => showToast("Invite copied"))}><Copy className="h-4 w-4" /> Copy</button>
                <a className="secondary-btn flex-1" href={invite}><Link2 className="h-4 w-4" /> Link</a>
              </div>
              <div className="mt-3 space-y-2">
                {(room.members || []).map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between rounded-md bg-[#111419] px-3 py-2 text-sm">
                    <span className="truncate">{m.display_name || m.username}</span>
                    <span className="flex items-center gap-2 text-xs text-[#8d949e]">{room.host_id === m.user_id && <Crown className="h-3 w-3 text-[#f1bf5b]" />}{m.can_control ? "control" : "watch"}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="panel">
            <h2 className="panel-title">Voice</h2>
            <div className="grid grid-cols-2 gap-2">
              <button className="secondary-btn" onClick={() => setVoice((s) => ({ ...s, muted: !s.muted }))}>{voice.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />} {voice.muted ? "Unmute" : "Mute"}</button>
              <button className="secondary-btn" onClick={() => setVoice((s) => ({ ...s, deafened: !s.deafened }))}>{voice.deafened ? "Undeafen" : "Deafen"}</button>
              <button className="secondary-btn" onMouseDown={() => setVoice((s) => ({ ...s, speaking: true, push_to_talk: true }))} onMouseUp={() => setVoice((s) => ({ ...s, speaking: false }))}>Push talk</button>
              <button className="secondary-btn" onClick={() => setVoice((s) => ({ ...s, speaking: !s.speaking }))}>VAD {voice.speaking ? "on" : "off"}</button>
            </div>
            <div className="mt-3 space-y-2">
              {voiceStates.map((v) => (
                <div key={v.user_id} className="flex items-center justify-between text-sm">
                  <span>{v.display_name}</span>
                  <span className={v.is_speaking ? "text-[#6ee7a8]" : "text-[#8d949e]"}>{v.is_speaking ? "speaking" : v.is_muted ? "muted" : "connected"}</span>
                </div>
              ))}
            </div>
          </section>

          {room && (
            <section className="panel">
              <h2 className="panel-title">Chat</h2>
              <div className="max-h-56 space-y-2 overflow-auto">
                {messages.map((m) => <p key={m.id} className="text-sm"><span className="text-[#8d949e]">{m.display_name}: </span>{m.message}</p>)}
              </div>
              <div className="mt-3 flex gap-2">
                <input className="field" value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="Message room" />
                <button className="icon-btn" onClick={sendMessage}><Send className="h-4 w-4" /></button>
              </div>
            </section>
          )}

          <section className="panel">
            <h2 className="panel-title">Public rooms</h2>
            <div className="space-y-2">
              {rooms.slice(0, 5).map((r) => (
                <button key={r.id} className="result" onClick={() => joinRoom(r, r.invite_code)}>
                  <span className="text-left">
                    <span className="block text-sm font-medium">{r.name}</span>
                    <span className="block text-xs text-[#8d949e]">{r.member_count || 0} watching {r.movie_title}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
