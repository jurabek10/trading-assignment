import { EventEmitter } from "node:events";
import type { Quote, Sector, SectorMeta, MarketIndex } from "@tma/shared";

const RECOMPUTE_DEBOUNCE_MS = 100;

export class Store extends EventEmitter {
  readonly sectorsMeta: SectorMeta[];
  private readonly shcodeToSector = new Map<string, string[]>();
  private readonly quotes = new Map<string, Quote>();
  private readonly scores = new Map<string, number>();
  private readonly pendingRecompute = new Map<string, NodeJS.Timeout>();
  private marketIndex: MarketIndex = {
    kospi: { value: 7838.12, change: 22.53, changePct: 0.29 },
    kosdaq: { value: 1161.13, change: 55.16, changePct: 4.99 },
  };

  constructor(sectorsMeta: SectorMeta[]) {
    super();
    this.sectorsMeta = sectorsMeta;
    for (const sector of sectorsMeta) {
      this.scores.set(sector.id, 0);
      for (const shcode of sector.shcodes) {
        const list = this.shcodeToSector.get(shcode) ?? [];
        list.push(sector.id);
        this.shcodeToSector.set(shcode, list);
      }
    }
  }

  applyQuote(quote: Quote): void {
    this.quotes.set(quote.shcode, quote);
    this.emit("quote", quote);
    const sectorIds = this.shcodeToSector.get(quote.shcode) ?? [];
    for (const sectorId of sectorIds) {
      this.scheduleRecompute(sectorId);
    }
  }

  setMarketIndex(index: MarketIndex): void {
    this.marketIndex = index;
    this.emit("marketIndex", index);
  }

  getMarketIndex(): MarketIndex {
    return this.marketIndex;
  }

  getQuote(shcode: string): Quote | undefined {
    return this.quotes.get(shcode);
  }

  getAllQuotes(): Record<string, Quote> {
    const out: Record<string, Quote> = {};
    for (const [k, v] of this.quotes) out[k] = v;
    return out;
  }

  getSectors(): Sector[] {
    // Sector score = mean of the top-3 change-rates; sectors are returned in
    // descending score order (spec §2.3), ties broken by id for stability.
    return this.sectorsMeta
      .map((s) => ({ ...s, score: this.scores.get(s.id) ?? 0 }))
      .sort((a, b) =>
        b.score !== a.score ? b.score - a.score : a.id.localeCompare(b.id),
      );
  }

  private scheduleRecompute(sectorId: string): void {
    if (this.pendingRecompute.has(sectorId)) return;
    const t = setTimeout(() => {
      this.pendingRecompute.delete(sectorId);
      this.recompute(sectorId);
    }, RECOMPUTE_DEBOUNCE_MS);
    this.pendingRecompute.set(sectorId, t);
  }

  private recompute(sectorId: string): void {
    const sector = this.sectorsMeta.find((s) => s.id === sectorId);
    if (!sector) return;
    const quotes = sector.shcodes
      .map((c) => this.quotes.get(c))
      .filter((q): q is Quote => q !== undefined)
      .sort((a, b) => {
        if (b.changeRate !== a.changeRate) return b.changeRate - a.changeRate;
        return a.shcode.localeCompare(b.shcode);
      });
    const top = quotes.slice(0, 3);
    const score = top.length === 0
      ? 0
      : top.reduce((sum, q) => sum + q.changeRate, 0) / top.length;
    this.scores.set(sectorId, score);
    this.emit("sectorScores", { [sectorId]: score });
  }
}
