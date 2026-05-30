"use client";
import { useState } from "react";
import WebNav from "@/components/WebNav";
import NuvioPlayer from "@/components/NuvioPlayer";
import ContentBrowser from "@/components/ContentBrowser";
import { FlyingEmoji } from "@/components/RoomPage/FlyingEmoji";
import { RoomHeader } from "@/components/RoomPage/RoomHeader";
import { ReactionBar } from "@/components/RoomPage/ReactionBar";
import { TabBar } from "@/components/RoomPage/TabBar";
import { ChatTab } from "@/components/RoomPage/ChatTab";
import { MembersTab } from "@/components/RoomPage/MembersTab";
import { InfoTab } from "@/components/RoomPage/InfoTab";
import { VoteTab } from "@/components/RoomPage/VoteTab";
import { LoadingState } from "@/components/RoomPage/LoadingState";
import { NotFoundState } from "@/components/RoomPage/NotFoundState";
import { useDeviceId } from "@/hooks/useDeviceId";
import { useRoomData } from "@/hooks/useRoomData";
import { useRoomMembership } from "@/hooks/useRoomMembership";
import { useRoomHeartbeat } from "@/hooks/useRoomHeartbeat";
import { useRoomChat } from "@/hooks/useRoomChat";
import { useRoomActions } from "@/hooks/useRoomActions";

export default function WebRoomPage({ params }) {
  const { id } = params;
  const { deviceId, userId } = useDeviceId();
  const {
    room,
    members,
    playbackState,
    isLoading,
    connectionStatus,
    syncRoom,
  } = useRoomData(id);
  const { messages, sendMessage, isSending } = useRoomChat(id, deviceId);
  const {
    reactionLoading,
    sendReaction,
    sendPlayback,
    permLoading,
    toggleControl,
    voteForm,
    setVoteForm,
    submitVote,
    handleLeave,
    handleShare,
  } = useRoomActions(id, deviceId, syncRoom);

  const [activeTab, setActiveTab] = useState("chat");
  const [msgText, setMsgText] = useState("");
  const [flyingEmojis, setFlyingEmojis] = useState([]);
  const [currentStream, setCurrentStream] = useState(null);
  const [streamInput, setStreamInput] = useState({
    url: "",
    subtitle: "",
    headers: "",
  });
  const [savingUrl, setSavingUrl] = useState(false);
  const [currentEngine, setCurrentEngine] = useState("none");

  useRoomMembership(id, room, members, userId, deviceId);
  useRoomHeartbeat(id, deviceId);

  const myMember = members.find((m) => m.user_id === userId);
  const isHost = room?.host_id === userId;
  const hasPlaybackControl = isHost || !!myMember?.has_playback_control;
  const contentUrl =
    currentStream?.url || playbackState?.content_url || room?.stream_url;
  const onlineCount = members.filter((m) => m.is_online).length;

  const handleSendMessage = () => {
    const msg = msgText.trim();
    if (!msg || !deviceId) return;
    setMsgText("");
    sendMessage(msg);
  };

  const handleReaction = async (emoji) => {
    if (typeof window === "undefined") return;
    const x = Math.random() * (window.innerWidth - 60) + 10;
    setFlyingEmojis((prev) => [...prev, { emoji, x, id: Date.now() }]);
    await sendReaction(emoji);
  };

  const handlePlay = (pos) => sendPlayback("PLAY", { position: pos });
  const handlePause = (pos) => sendPlayback("PAUSE", { position: pos });
  const handleSeek = (pos) => sendPlayback("SEEK", { position: pos });
  const handleSkipFwd = () => sendPlayback("SKIP_FORWARD");
  const handleSkipBack = () => sendPlayback("SKIP_BACKWARD");

  const handleStreamSelected = async (stream) => {
    const firstSubtitle = Array.isArray(stream.subtitles)
      ? stream.subtitles[0]
      : null;
    const subtitleUrl =
      firstSubtitle?.url || firstSubtitle?.externalUrl || null;
    const subtitleLabel =
      firstSubtitle?.name || firstSubtitle?.title || firstSubtitle?.lang || "Subtitles";

    setCurrentStream({
      url: stream.url,
      title: stream.title,
      mimeType: stream.mimeType,
      subtitleUrl,
      subtitleLabel,
      headers: stream.headers || {},
    });
    if (hasPlaybackControl)
      await sendPlayback("CHANGE_CONTENT", {
        content_url: stream.url,
        mime_type: stream.mimeType || null,
        subtitle_url: subtitleUrl,
        subtitle_label: subtitleLabel,
        headers: stream.headers || {},
      });
  };

  const handleLoadUrl = async () => {
    const url = streamInput.url.trim();
    if (!url) return;
    setSavingUrl(true);
    let headers = {};
    try {
      if (streamInput.headers.trim()) headers = JSON.parse(streamInput.headers);
    } catch {}
    const subtitleUrl = streamInput.subtitle.trim() || null;
    const subtitleLabel = "Subtitles";
    setCurrentStream({
      url,
      subtitleUrl,
      subtitleLabel,
      headers,
    });
    if (hasPlaybackControl)
      await sendPlayback("CHANGE_CONTENT", {
        content_url: url,
        subtitle_url: subtitleUrl,
        subtitle_label: subtitleLabel,
        headers,
      });
    setStreamInput({ url: "", subtitle: "", headers: "" });
    setSavingUrl(false);
  };

  if (isLoading) return <LoadingState />;
  if (!room) return <NotFoundState />;

  const TABS = [
    { key: "chat", label: "💬 Chat" },
    { key: "content", label: "🎬 Content" },
    { key: "members", label: `👥 (${members.length})` },
    { key: "info", label: "ℹ️ Info" },
    { key: "vote", label: "🗳️" },
  ];

  const inputSt = {
    width: "100%",
    padding: "9px 12px",
    background: "#0B0F1A",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    color: "#F1F5F9",
    fontSize: 13,
    outline: "none",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0B0F1A",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <WebNav active="Rooms" />

      {flyingEmojis.map((fe) => (
        <FlyingEmoji
          key={fe.id}
          emoji={fe.emoji}
          x={fe.x}
          id={fe.id}
          onDone={() => setFlyingEmojis((p) => p.filter((e) => e.id !== fe.id))}
        />
      ))}

      <div
        style={{
          display: "flex",
          flex: 1,
          paddingTop: 60,
          height: "calc(100vh - 60px)",
          overflow: "hidden",
        }}
      >
        {/* ── Left: Player column ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <RoomHeader
            room={room}
            onlineCount={onlineCount}
            membersCount={members.length}
            onShare={() => handleShare(room)}
            onLeave={() => handleLeave(room, isHost)}
            extraBadges={[
              isHost
                ? {
                    label: "👑 Host",
                    color: "#F59E0B",
                    bg: "rgba(245,158,11,0.1)",
                  }
                : null,
              !isHost && hasPlaybackControl
                ? {
                    label: "🎮 Co-host",
                    color: "#818CF8",
                    bg: "rgba(99,102,241,0.1)",
                  }
                : null,
              currentEngine !== "none"
                ? {
                    label: currentEngine.toUpperCase(),
                    color: "#6366F1",
                    bg: "rgba(99,102,241,0.08)",
                  }
                : null,
            ].filter(Boolean)}
          />

          <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
            {room.status === "ended" ? (
              <div
                style={{
                  background: "#0A0A0A",
                  borderRadius: 12,
                  padding: "40px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 8 }}>🎬</div>
                <div style={{ color: "#4B5563" }}>This room has ended.</div>
              </div>
            ) : (
              <NuvioPlayer
                contentUrl={contentUrl}
                mimeType={currentStream?.mimeType || playbackState?.mime_type}
                subtitleUrl={currentStream?.subtitleUrl || playbackState?.subtitle_url}
                subtitleLabel={currentStream?.subtitleLabel || playbackState?.subtitle_label}
                headers={currentStream?.headers || playbackState?.headers || {}}
                videoId={id}
                roomId={id}
                isHost={hasPlaybackControl}
                playbackState={playbackState}
                onPlay={handlePlay}
                onPause={handlePause}
                onSeek={handleSeek}
                onSkipForward={handleSkipFwd}
                onSkipBackward={handleSkipBack}
                onEngineChange={setCurrentEngine}
                title={currentStream?.title || room.movie_title}
              />
            )}
          </div>

          {room.status !== "ended" && (
            <ReactionBar onReact={handleReaction} loading={reactionLoading} />
          )}
        </div>

        {/* ── Right: Side panel ── */}
        <div
          style={{
            width: 380,
            borderLeft: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            flexDirection: "column",
            background: "#0D1117",
            flexShrink: 0,
          }}
        >
          <TabBar
            tabs={TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          {activeTab === "chat" && (
            <ChatTab
              messages={messages}
              userId={userId}
              msgText={msgText}
              onMsgTextChange={setMsgText}
              onSend={handleSendMessage}
              sending={isSending}
              roomEnded={room.status === "ended"}
            />
          )}

          {/* ── Content tab — Nuvio player + ContentBrowser ── */}
          {activeTab === "content" && (
            <div
              style={{
                flex: 1,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {hasPlaybackControl && (
                <div
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                    flexShrink: 0,
                    background: "rgba(99,102,241,0.04)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#6366F1",
                      fontWeight: 800,
                      marginBottom: 8,
                      letterSpacing: 1,
                    }}
                  >
                    ▶ PASTE STREAM URL
                  </div>
                  <input
                    value={streamInput.url}
                    onChange={(e) =>
                      setStreamInput((s) => ({ ...s, url: e.target.value }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && handleLoadUrl()}
                    placeholder=".m3u8 / .mpd / .mp4 / direct URL…"
                    style={{ ...inputSt, marginBottom: 6 }}
                  />
                  <input
                    value={streamInput.subtitle}
                    onChange={(e) =>
                      setStreamInput((s) => ({
                        ...s,
                        subtitle: e.target.value,
                      }))
                    }
                    placeholder="Subtitle URL (.srt / .vtt) — optional"
                    style={{ ...inputSt, marginBottom: 6 }}
                  />
                  <input
                    value={streamInput.headers}
                    onChange={(e) =>
                      setStreamInput((s) => ({ ...s, headers: e.target.value }))
                    }
                    placeholder="Request headers JSON — optional"
                    style={{ ...inputSt, marginBottom: 8 }}
                  />
                  <button
                    onClick={handleLoadUrl}
                    disabled={!streamInput.url.trim() || savingUrl}
                    style={{
                      width: "100%",
                      padding: "9px",
                      borderRadius: 9,
                      fontSize: 13,
                      fontWeight: 700,
                      background: streamInput.url.trim()
                        ? "#4F46E5"
                        : "#1E293B",
                      color: streamInput.url.trim() ? "#fff" : "#4B5563",
                      border: "none",
                      cursor: streamInput.url.trim() ? "pointer" : "default",
                    }}
                  >
                    {savingUrl ? "Loading…" : "▶ Load Stream"}
                  </button>
                </div>
              )}
              <div style={{ flex: 1, overflow: "hidden" }}>
                <ContentBrowser
                  onSelectStream={handleStreamSelected}
                  onClose={null}
                />
              </div>
            </div>
          )}

          {activeTab === "members" && (
            <MembersTab
              members={members}
              userId={userId}
              hostId={room.host_id}
              isHost={isHost}
              isPublic={room.is_public}
              onToggleControl={toggleControl}
              permLoading={permLoading}
            />
          )}

          {activeTab === "info" && (
            <InfoTab
              room={room}
              membersCount={members.length}
              connectionStatus={connectionStatus}
              onShare={() => handleShare(room)}
              extraInfo={[{ label: "Engine", value: currentEngine || "—" }]}
            />
          )}

          {activeTab === "vote" && (
            <VoteTab
              voteForm={voteForm}
              onVoteFormChange={setVoteForm}
              onSubmitVote={submitVote}
            />
          )}
        </div>
      </div>
    </div>
  );
}
