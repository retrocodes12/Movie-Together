import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";

export function useRoomChat(roomId, deviceId) {
  const [messages, setMessages] = useState([]);
  const [lastMsgId, setLastMsgId] = useState(null);
  const msgPollRef = useRef(null);

  const fetchMsgs = useCallback(
    async (after) => {
      try {
        const url = after
          ? `/api/rooms/${roomId}/messages?after=${after}&limit=50`
          : `/api/rooms/${roomId}/messages?limit=50`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const newMsgs = data.messages || [];
        if (newMsgs.length > 0) {
          setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            return [...prev, ...newMsgs.filter((m) => !ids.has(m.id))];
          });
          setLastMsgId(newMsgs[newMsgs.length - 1].id);
        }
      } catch {}
    },
    [roomId],
  );

  useEffect(() => {
    fetchMsgs(null);
    msgPollRef.current = setInterval(() => {
      setLastMsgId((curr) => {
        fetchMsgs(curr);
        return curr;
      });
    }, 4000);
    return () => clearInterval(msgPollRef.current);
  }, [fetchMsgs]);

  const sendMsg = useMutation({
    mutationFn: async (msg) => {
      const res = await fetch(`/api/rooms/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceId, message: msg }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        return ids.has(data.message.id) ? prev : [...prev, data.message];
      });
      setLastMsgId(data.message.id);
    },
  });

  return {
    messages,
    sendMessage: sendMsg.mutate,
    isSending: sendMsg.isPending,
  };
}
