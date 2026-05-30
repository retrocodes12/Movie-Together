import { useEffect } from "react";

export function useRoomHeartbeat(roomId, deviceId) {
  useEffect(() => {
    if (!deviceId || !roomId) return;
    const hb = () =>
      fetch(`/api/rooms/${roomId}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceId }),
      }).catch(() => {});
    hb();
    const t = setInterval(hb, 15000);
    return () => clearInterval(t);
  }, [deviceId, roomId]);
}
