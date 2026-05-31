export type Quote = {
  shcode: string;
  name: string;
  price: number;
  changeRate: number;
  tradingValue: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  lastTradeTime?: string;
  ts: number;
};

export type SectorMeta = {
  id: string;
  nameKo: string;
  nameEn: string;
  headline: string;
  shcodes: string[];
};

export type Sector = SectorMeta & {
  score: number;
};

export type Snapshot = {
  sectors: Sector[];
  quotes: Record<string, Quote>;
  marketIndex: MarketIndex;
  serverTs: number;
};

export type MarketIndex = {
  kospi: { value: number; change: number; changePct: number };
  kosdaq: { value: number; change: number; changePct: number };
};

export type WSMessage =
  | { type: "snapshot"; snapshot: Snapshot }
  | { type: "quote"; quote: Quote }
  | { type: "sectorScores"; scores: Record<string, number> }
  | { type: "marketIndex"; index: MarketIndex }
  | { type: "heartbeat"; ts: number };
