import { useState, useEffect } from "react";

export function useDeviceId() {
  const [deviceId, setDeviceId] = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    let id = localStorage.getItem("mt_device_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("mt_device_id", id);
    }
    setDeviceId(id);
    const u = localStorage.getItem("mt_user");
    if (u)
      try {
        setUserId(JSON.parse(u)?.id);
      } catch {}
  }, []);

  return { deviceId, userId };
}
