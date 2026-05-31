import WebSocket from "ws";
import type { Quote, SectorMeta } from "@tma/shared";
import type { Store } from "../store.js";
import type { Logger } from "pino";

/**
 * Live quote feed backed by the LS증권 (LS Securities) Open API.
 *
 * Pipeline:
 *   1. OAuth2 client-credentials token  ->  Bearer access_token
 *   2. t8436 (주식종목조회) once         ->  map each shcode to its market (KOSPI/KOSDAQ)
 *   3. t1102 (주식현재가(시세)) per code  ->  initial snapshot Quote into the Store (REST)
 *   4. WebSocket S3_/K3_ (주식체결) per code -> real-time tick Quotes into the Store
 *
 * The Store + ws-hub then aggregate/rank and broadcast exactly as with MockFeed,
 * so nothing downstream (REST, WS contract, sorting) changes.
 *
 * Units: LS `value` (누적거래대금) is returned in 백만원 (millions of KRW); we convert
 * to raw KRW so the frontend's `formatTradingValue` (raw KRW -> 억) stays correct.
 */

const VALUE_UNIT_KRW = 1_000_000; // LS 누적거래대금 단위: 백만원
const TOKEN_REFRESH_RATIO = 0.9; // refresh token at 90% of its lifetime
const WS_RECONNECT_BASE_MS = 1_000;
const WS_RECONNECT_MAX_MS = 30_000;

type Market = "S3_" | "K3_"; // KOSPI 체결 / KOSDAQ 체결 real-time TR codes

type SeedStock = { shcode: string; name: string };

function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** LS sign code: 1 상한, 2 상승, 3 보합, 4 하한, 5 하락. Returns -1/0/+1. */
function signFromCode(sign: unknown): number {
  const s = String(sign ?? "").trim();
  if (s === "4" || s === "5") return -1;
  if (s === "1" || s === "2") return 1;
  return 0;
}

/** "093015" (HHMMSS) -> "09:30". */
function hhmm(chetime: unknown): string | undefined {
  const s = String(chetime ?? "").padStart(6, "0");
  if (s.length < 4) return undefined;
  return `${s.slice(0, 2)}:${s.slice(2, 4)}`;
}

export class LsFeed {
  private token = "";
  private tokenTimer: NodeJS.Timeout | null = null;
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectMs = WS_RECONNECT_BASE_MS;
  private stopped = false;
  private readonly seeds: SeedStock[];
  private readonly market = new Map<string, Market>();

  constructor(
    private readonly store: Store,
    sectorsMeta: SectorMeta[],
    names: Record<string, string>,
    private readonly log: Logger,
    private readonly cfg: {
      appKey: string;
      appSecret: string;
      restBase: string;
      wsBase: string;
    },
  ) {
    const seen = new Set<string>();
    this.seeds = [];
    for (const s of sectorsMeta) {
      for (const code of s.shcodes) {
        if (seen.has(code)) continue;
        seen.add(code);
        this.seeds.push({ shcode: code, name: names[code] ?? code });
      }
    }
  }

  async start(): Promise<void> {
    if (!this.cfg.appKey || !this.cfg.appSecret) {
      throw new Error("LS_APP_KEY / LS_APP_SECRET are required when USE_LS=1");
    }
    await this.authenticate();
    await this.loadMarkets();
    await this.primeInitialQuotes();
    this.connectWs();
    this.log.info({ stocks: this.seeds.length }, "LS feed started");
  }

  stop(): void {
    this.stopped = true;
    if (this.tokenTimer) clearTimeout(this.tokenTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  // --- 1. OAuth ------------------------------------------------------------

  private async authenticate(): Promise<void> {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      appkey: this.cfg.appKey,
      appsecretkey: this.cfg.appSecret,
      scope: "oob",
    });
    const res = await fetch(`${this.cfg.restBase}/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      throw new Error(`LS token failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.token = json.access_token;
    const ttl = (json.expires_in || 86_400) * 1000 * TOKEN_REFRESH_RATIO;
    this.tokenTimer = setTimeout(() => {
      this.authenticate().catch((err) =>
        this.log.error({ err }, "LS token refresh failed"),
      );
    }, ttl);
    this.log.info({ expiresIn: json.expires_in }, "LS token acquired");
  }

  // --- 2. Market classification (t8436) -----------------------------------

  private async loadMarkets(): Promise<void> {
    // gubun "1" = KOSPI list, "2" = KOSDAQ list. Membership tells us the market.
    await Promise.all([this.loadMarket("1", "S3_"), this.loadMarket("2", "K3_")]);
    for (const seed of this.seeds) {
      if (!this.market.has(seed.shcode)) {
        // Default unknown codes to KOSPI; harmless if wrong (no ticks arrive).
        this.market.set(seed.shcode, "S3_");
        this.log.warn({ shcode: seed.shcode }, "market unknown, defaulting KOSPI");
      }
    }
  }

  private async loadMarket(gubun: "1" | "2", tr: Market): Promise<void> {
    const out = await this.trRequest<{ shcode: string }[]>(
      "/stock/etc",
      "t8436",
      { t8436InBlock: { gubun } },
      "t8436OutBlock",
    );
    const wanted = new Set(this.seeds.map((s) => s.shcode));
    for (const row of out ?? []) {
      if (wanted.has(row.shcode)) this.market.set(row.shcode, tr);
    }
  }

  // --- 3. Initial snapshot (t1102) ----------------------------------------

  private async primeInitialQuotes(): Promise<void> {
    for (const seed of this.seeds) {
      try {
        const b = await this.trRequest<Record<string, unknown>>(
          "/stock/market-data",
          "t1102",
          { t1102InBlock: { shcode: seed.shcode } },
          "t1102OutBlock",
        );
        if (b) this.store.applyQuote(this.toQuoteFromT1102(seed, b));
      } catch (err) {
        this.log.warn({ err, shcode: seed.shcode }, "t1102 failed");
      }
    }
  }

  private toQuoteFromT1102(seed: SeedStock, b: Record<string, unknown>): Quote {
    const price = num(b.price);
    const rate = num(b.diff) * (signFromCode(b.sign) || 1);
    const change = num(b.change) * (signFromCode(b.sign) || 1);
    const prevClose = num(b.recprice) || price - change || price;
    return {
      shcode: seed.shcode,
      name: String(b.hname || seed.name),
      price,
      changeRate: rate,
      tradingValue: num(b.value) * VALUE_UNIT_KRW,
      high: num(b.high) || price,
      low: num(b.low) || price,
      open: num(b.open) || price,
      prevClose,
      lastTradeTime: undefined,
      ts: Date.now(),
    };
  }

  /** POST an LS TR request and return the named OutBlock. */
  private async trRequest<T>(
    path: string,
    trCd: string,
    body: unknown,
    outBlock: string,
  ): Promise<T | undefined> {
    const res = await fetch(`${this.cfg.restBase}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        authorization: `Bearer ${this.token}`,
        tr_cd: trCd,
        tr_cont: "N",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${trCd} ${res.status} ${await res.text()}`);
    const json = (await res.json()) as Record<string, unknown>;
    return json[outBlock] as T | undefined;
  }

  // --- 4. Real-time WebSocket (S3_/K3_) -----------------------------------

  private connectWs(): void {
    if (this.stopped) return;
    const ws = new WebSocket(this.cfg.wsBase);
    this.ws = ws;

    ws.on("open", () => {
      this.reconnectMs = WS_RECONNECT_BASE_MS;
      this.log.info("LS websocket open, subscribing");
      for (const seed of this.seeds) {
        const tr = this.market.get(seed.shcode) ?? "S3_";
        ws.send(
          JSON.stringify({
            header: { token: this.token, tr_type: "3" },
            body: { tr_cd: tr, tr_key: seed.shcode },
          }),
        );
      }
    });

    ws.on("message", (data) => this.onMessage(data.toString()));
    ws.on("close", () => this.scheduleReconnect());
    ws.on("error", (err) => {
      this.log.warn({ err }, "LS websocket error");
      ws.close();
    });
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectMs = Math.min(this.reconnectMs * 2, WS_RECONNECT_MAX_MS);
      this.connectWs();
    }, this.reconnectMs);
  }

  private onMessage(raw: string): void {
    let msg: { header?: Record<string, unknown>; body?: Record<string, unknown> };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const trCd = String(msg.header?.tr_cd ?? "");
    if (trCd !== "S3_" && trCd !== "K3_") return; // ignore acks/heartbeats
    const b = msg.body;
    if (!b || b.price == null) return;

    const shcode = String(b.shcode ?? msg.header?.tr_key ?? "");
    const prev = this.store.getQuote(shcode);
    if (!prev) return;

    const price = num(b.price);
    const rate =
      b.drate != null ? num(b.drate) * (signFromCode(b.sign) || 1) : prev.changeRate;
    this.store.applyQuote({
      ...prev,
      price,
      changeRate: rate,
      tradingValue: b.value != null ? num(b.value) * VALUE_UNIT_KRW : prev.tradingValue,
      high: Math.max(prev.high, price),
      low: prev.low === 0 ? price : Math.min(prev.low, price),
      open: num(b.open) || prev.open,
      lastTradeTime: hhmm(b.chetime) ?? prev.lastTradeTime,
      ts: Date.now(),
    });
  }
}
