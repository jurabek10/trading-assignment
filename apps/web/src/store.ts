import { create } from "zustand";
import type { Quote, Sector, Snapshot, MarketIndex } from "@tma/shared";

type State = {
  sectors: Record<string, Sector>;
  sectorOrder: string[];
  quotes: Record<string, Quote>;
  marketIndex: MarketIndex | null;
  serverTs: number;
  connected: boolean;
  applySnapshot: (s: Snapshot) => void;
  applyQuote: (q: Quote) => void;
  applyScores: (scores: Record<string, number>) => void;
  applyIndex: (i: MarketIndex) => void;
  setConnected: (c: boolean) => void;
};

export const useStore = create<State>((set) => ({
  sectors: {},
  sectorOrder: [],
  quotes: {},
  marketIndex: null,
  serverTs: 0,
  connected: false,
  applySnapshot: (s) =>
    set(() => {
      const sectors: Record<string, Sector> = {};
      const order: string[] = [];
      for (const sec of s.sectors) {
        sectors[sec.id] = sec;
        order.push(sec.id);
      }
      return {
        sectors,
        sectorOrder: order,
        quotes: s.quotes,
        marketIndex: s.marketIndex,
        serverTs: s.serverTs,
      };
    }),
  applyQuote: (q) =>
    set((state) => ({
      quotes: { ...state.quotes, [q.shcode]: q },
      serverTs: q.ts,
    })),
  applyScores: (scores) =>
    set((state) => {
      const next: Record<string, Sector> = { ...state.sectors };
      for (const [id, score] of Object.entries(scores)) {
        const prev = next[id];
        if (prev) next[id] = { ...prev, score };
      }
      return { sectors: next };
    }),
  applyIndex: (i) => set(() => ({ marketIndex: i })),
  setConnected: (c) => set(() => ({ connected: c })),
}));
