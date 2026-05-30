import { useEffect } from "react";

export function useRoomMembership(roomId, room, members, userId, deviceId) {
  useEffect(() => {
    if (!room || !deviceId) return;
    const isMember = members.some((m) => m.user_id === userId);
    if (!isMember) {
      fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceId }),
      }).catch(() => {});
    }
  }, [room?.id, deviceId, members, userId, roomId]);
}
