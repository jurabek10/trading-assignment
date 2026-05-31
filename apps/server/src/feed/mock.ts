import type { Quote, SectorMeta } from "@tma/shared";
import type { Store } from "../store.js";
import type { Logger } from "pino";

type SeedStock = {
  shcode: string;
  name: string;
  basePrice: number;
  prevClose: number;
};

function seedFromMeta(
  sectorsMeta: SectorMeta[],
  names: Record<string, string>,
): SeedStock[] {
  const seen = new Set<string>();
  const out: SeedStock[] = [];
  for (const s of sectorsMeta) {
    for (const code of s.shcodes) {
      if (seen.has(code)) continue;
      seen.add(code);
      const basePrice = pickBasePrice(code);
      out.push({
        shcode: code,
        name: names[code] ?? code,
        basePrice,
        prevClose: basePrice,
      });
    }
  }
  return out;
}

function pickBasePrice(code: string): number {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) | 0;
  const tiers = [3000, 13000, 42000, 102000, 155000, 225000, 643000, 1330000];
  return tiers[Math.abs(h) % tiers.length];
}

function formatHHmm(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export type MockFeedOptions = {
  tickIntervalMs?: number;
  perTickProbability?: number;
  maxStepPct?: number;
  initialBias?: number;
};

export class MockFeed {
  private timer: NodeJS.Timeout | null = null;
  private readonly seeds: SeedStock[];
  private readonly opts: Required<MockFeedOptions>;

  constructor(
    private readonly store: Store,
    sectorsMeta: SectorMeta[],
    names: Record<string, string>,
    private readonly log: Logger,
    opts: MockFeedOptions = {},
  ) {
    this.seeds = seedFromMeta(sectorsMeta, names);
    this.opts = {
      tickIntervalMs: opts.tickIntervalMs ?? 700,
      perTickProbability: opts.perTickProbability ?? 0.35,
      maxStepPct: opts.maxStepPct ?? 0.6,
      initialBias: opts.initialBias ?? 7,
    };
  }

  start(): void {
    this.primeInitialQuotes();
    this.timer = setInterval(() => this.tick(), this.opts.tickIntervalMs);
    this.log.info(
      { stocks: this.seeds.length, intervalMs: this.opts.tickIntervalMs },
      "mock feed started",
    );
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private primeInitialQuotes(): void {
    const now = Date.now();
    const t = new Date(now);
    for (const seed of this.seeds) {
      const changePct =
        (Math.random() - 0.4) * 2 * this.opts.initialBias;
      const price = roundTickSize(seed.prevClose * (1 + changePct / 100));
      const dailySwing = Math.max(0.5, Math.abs(changePct) * 1.2);
      const high = roundTickSize(
        seed.prevClose * (1 + (Math.abs(changePct) + dailySwing / 2) / 100),
      );
      const low = roundTickSize(
        seed.prevClose * (1 - dailySwing / 2 / 100),
      );
      const open = roundTickSize(
        seed.prevClose * (1 + (Math.random() - 0.5) * 0.01),
      );
      const tradingValue = Math.round(
        price * (1000 + Math.random() * 50000) * 10,
      );
      const quote: Quote = {
        shcode: seed.shcode,
        name: seed.name,
        price,
        changeRate: round2(changePct),
        tradingValue,
        high: Math.max(high, price, open),
        low: Math.min(low, price, open),
        open,
        prevClose: seed.prevClose,
        lastTradeTime: formatHHmm(t),
        ts: now,
      };
      this.store.applyQuote(quote);
    }
  }

  private tick(): void {
    const now = Date.now();
    const t = new Date(now);
    for (const seed of this.seeds) {
      if (Math.random() > this.opts.perTickProbability) continue;
      const prev = this.store.getQuote(seed.shcode);
      if (!prev) continue;
      const stepPct = (Math.random() - 0.48) * this.opts.maxStepPct;
      const nextPrice = roundTickSize(prev.price * (1 + stepPct / 100));
      const newChange = ((nextPrice - prev.prevClose) / prev.prevClose) * 100;
      const tradingDelta = Math.round(nextPrice * (50 + Math.random() * 5000));
      const next: Quote = {
        ...prev,
        price: nextPrice,
        changeRate: round2(newChange),
        tradingValue: prev.tradingValue + tradingDelta,
        high: Math.max(prev.high, nextPrice),
        low: Math.min(prev.low, nextPrice),
        lastTradeTime: formatHHmm(t),
        ts: now,
      };
      this.store.applyQuote(next);
    }
    this.driftIndex();
  }

  private driftIndex(): void {
    const idx = this.store.getMarketIndex();
    const kospiDelta = (Math.random() - 0.5) * 4;
    const kosdaqDelta = (Math.random() - 0.5) * 2;
    const kospiValue = round2(idx.kospi.value + kospiDelta);
    const kosdaqValue = round2(idx.kosdaq.value + kosdaqDelta);
    this.store.setMarketIndex({
      kospi: {
        value: kospiValue,
        change: round2(idx.kospi.change + kospiDelta),
        changePct: round2(
          ((idx.kospi.change + kospiDelta) /
            (kospiValue - (idx.kospi.change + kospiDelta))) *
            100,
        ),
      },
      kosdaq: {
        value: kosdaqValue,
        change: round2(idx.kosdaq.change + kosdaqDelta),
        changePct: round2(
          ((idx.kosdaq.change + kosdaqDelta) /
            (kosdaqValue - (idx.kosdaq.change + kosdaqDelta))) *
            100,
        ),
      },
    });
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function roundTickSize(price: number): number {
  if (price < 1000) return Math.round(price);
  if (price < 5000) return Math.round(price / 5) * 5;
  if (price < 10000) return Math.round(price / 10) * 10;
  if (price < 50000) return Math.round(price / 50) * 50;
  if (price < 100000) return Math.round(price / 100) * 100;
  if (price < 500000) return Math.round(price / 500) * 500;
  return Math.round(price / 1000) * 1000;
}
