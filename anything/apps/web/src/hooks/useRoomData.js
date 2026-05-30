import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

export function useRoomData(roomId) {
  const [roomSyncState, setRoomSyncState] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("connecting");

  const { data: roomData, isLoading } = useQuery({
    queryKey: ["room", roomId],
    queryFn: async () => {
      const res = await fetch(`/api/rooms/${roomId}`);
      if (!res.ok) throw new Error("Room not found");
      return res.json();
    },
    enabled: !!roomId,
  });

  const syncRoom = useCallback(async () => {
    if (!roomId) return;
    try {
      const res = await fetch(`/api/rooms/${roomId}`);
      if (!res.ok) return;
      const data = await res.json();
      setRoomSyncState(
        data.room
          ? {
              room: data.room,
              members: data.room.members,
              playback_state: data.room.playback_state,
            }
          : null,
      );
      setConnectionStatus("connected");
    } catch {
      setConnectionStatus("reconnecting");
    }
  }, [roomId]);

  useEffect(() => {
    syncRoom();
    const interval = setInterval(syncRoom, 5000);
    return () => clearInterval(interval);
  }, [syncRoom]);

  const room = roomSyncState?.room || roomData?.room;
  const members = roomSyncState?.members || roomData?.room?.members || [];
  const playbackState = roomSyncState?.playback_state || room?.playback_state;

  return {
    room,
    members,
    playbackState,
    isLoading,
    connectionStatus,
    syncRoom,
  };
}
