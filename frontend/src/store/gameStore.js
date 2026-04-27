import { create } from "zustand";

export const useAuthStore = create((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  logout: () => set({ user: null }),
}));

export const useGameStore = create((set, get) => ({
  code: null,
  state: null,
  room: null,
  yourSide: null,
  selected: null, // node id
  lastEvents: [],
  events: [], // event log
  connected: false,

  setConnected: (c) => set({ connected: c }),
  setRoom: (room) => set({ room }),
  setYourSide: (s) => set({ yourSide: s }),
  setCode: (code) => set({ code }),
  select: (nodeId) => set({ selected: nodeId }),
  reset: () =>
    set({
      code: null,
      state: null,
      room: null,
      yourSide: null,
      selected: null,
      events: [],
      lastEvents: [],
      connected: false,
    }),
  applyServer: (msg) => {
    const updates = {};
    if (msg.state) updates.state = msg.state;
    if (msg.room) updates.room = msg.room;
    if (msg.your_side) updates.yourSide = msg.your_side;
    if (Array.isArray(msg.events) && msg.events.length) {
      updates.lastEvents = msg.events;
      const prev = get().events;
      updates.events = [...msg.events, ...prev].slice(0, 25);
    }
    updates.selected = null;
    set(updates);
  },
}));
