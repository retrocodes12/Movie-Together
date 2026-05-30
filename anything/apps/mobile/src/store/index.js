import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const USER_KEY = "@movietogether:user";
const DEVICE_KEY = "@movietogether:device_id";

function generateDeviceId() {
  return (
    "dev_" + Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
  );
}

export const useStore = create((set, get) => ({
  // Auth State
  user: null,
  deviceId: null,
  isLoading: true,

  // Room State
  currentRoom: null,
  rooms: [],

  // UI State
  colorScheme: "light",

  // --- Actions ---

  init: async () => {
    try {
      let deviceId = await AsyncStorage.getItem(DEVICE_KEY);
      if (!deviceId) {
        deviceId = generateDeviceId();
        await AsyncStorage.setItem(DEVICE_KEY, deviceId);
      }

      const userStr = await AsyncStorage.getItem(USER_KEY);
      const user = userStr ? JSON.parse(userStr) : null;

      set({ deviceId, user, isLoading: false });
    } catch (e) {
      console.error("Store init error:", e);
      set({ isLoading: false });
    }
  },

  setUser: async (user) => {
    try {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
      set({ user });
    } catch (e) {
      console.error("setUser error:", e);
    }
  },

  logout: async () => {
    try {
      await AsyncStorage.removeItem(USER_KEY);
      set({ user: null, currentRoom: null });
    } catch (e) {
      console.error("logout error:", e);
    }
  },

  setCurrentRoom: (room) => set({ currentRoom: room }),
  setRooms: (rooms) => set({ rooms }),
  setColorScheme: (scheme) => set({ colorScheme: scheme }),

  // Sync user from server
  syncUser: async () => {
    const { deviceId } = get();
    if (!deviceId) return;

    try {
      const res = await fetch(`/api/profile?device_id=${deviceId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
          set({ user: data.user });
        }
      }
    } catch (e) {
      console.error("syncUser error:", e);
    }
  },
}));
