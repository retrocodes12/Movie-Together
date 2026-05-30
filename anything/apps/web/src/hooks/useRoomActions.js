import { useState, useRef } from "react";

export function useRoomActions(roomId, deviceId, syncRoom) {
  const [reactionLoading, setReactionLoading] = useState(null);
  const [streamUrlInput, setStreamUrlInput] = useState("");
  const [savingUrl, setSavingUrl] = useState(false);
  const [permLoading, setPermLoading] = useState(null);
  const [voteForm, setVoteForm] = useState({
    show: false,
    label: "",
    type: "skip",
  });
  const watchStartRef = useRef(Date.now());

  const sendReaction = async (emoji) => {
    if (reactionLoading) return;
    setReactionLoading(emoji);
    try {
      await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceId, room_id: roomId, emoji }),
      });
    } catch {}
    setTimeout(() => setReactionLoading(null), 1000);
  };

  const sendPlayback = async (event, payload = {}) => {
    if (!deviceId) return;
    await fetch(`/api/rooms/${roomId}/playback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId, event, payload }),
    }).catch(() => {});
    setTimeout(syncRoom, 500);
  };

  const handleSaveUrl = async () => {
    if (!streamUrlInput.trim()) return;
    setSavingUrl(true);
    try {
      await sendPlayback("CHANGE_CONTENT", {
        content_url: streamUrlInput.trim(),
      });
      await syncRoom();
      setStreamUrlInput("");
    } catch {}
    setSavingUrl(false);
  };

  const toggleControl = async (targetUserId, currentlyHas) => {
    setPermLoading(targetUserId);
    try {
      await fetch(`/api/rooms/${roomId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: deviceId,
          target_user_id: targetUserId,
          action: currentlyHas ? "revoke" : "grant",
        }),
      });
      await syncRoom();
    } catch {}
    setPermLoading(null);
  };

  const submitVote = async () => {
    if (!voteForm.label.trim()) return;
    await fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: deviceId,
        room_id: roomId,
        vote_type: voteForm.type,
        label: voteForm.label,
      }),
    }).catch(() => {});
    setVoteForm({ show: false, label: "", type: "skip" });
  };

  const handleLeave = async (room, isHost) => {
    if (
      !confirm(
        isHost
          ? "Leave room? Another member will become host."
          : "Leave this room?",
      )
    )
      return;
    const wd = Math.floor((Date.now() - watchStartRef.current) / 1000);
    if (room && wd > 30) {
      fetch("/api/watchhistory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: deviceId,
          room_id: roomId,
          movie_key: room.stream_url || `room_${roomId}`,
          movie_title: room.movie_title,
          watch_duration: wd,
        }),
      }).catch(() => {});
    }
    await fetch(`/api/rooms/${roomId}/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId }),
    }).catch(() => {});
    window.location.href = "/rooms";
  };

  const handleShare = async (room) => {
    const link = `${window.location.origin}/join/${room?.invite_code}`;
    try {
      await navigator.share({
        title: room?.name,
        text: `Join my watch party: ${room?.movie_title}`,
        url: link,
      });
    } catch {
      navigator.clipboard
        .writeText(link)
        .then(() => alert("Link copied!"))
        .catch(() => {});
    }
  };

  return {
    reactionLoading,
    sendReaction,
    sendPlayback,
    streamUrlInput,
    setStreamUrlInput,
    savingUrl,
    handleSaveUrl,
    permLoading,
    toggleControl,
    voteForm,
    setVoteForm,
    submitVote,
    handleLeave,
    handleShare,
  };
}
