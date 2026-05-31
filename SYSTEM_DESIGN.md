# System Design Specification — TMA Market Center Clone

## 1. Overview

A real-time stock market dashboard web application that replicates the "Market Center" (마켓중심) view of the TMA trading client. The page displays six predefined sectors with their constituent stocks, with prices and rise-rates streaming live from the LS Securities (LS증권) API.

### 1.1 Goals
- Render six sector cards in a responsive grid (matching the reference UI).
- Reflect intraday quote changes in real time via WebSocket.
- Sort sectors and stocks deterministically by rise-rate.
- Be reachable from a public URL (assignment submission requirement).

### 1.2 Non-Goals
- Order placement / trading execution.
- Authenticated user accounts or watchlists.
- Historical chart drill-downs (only the sparkline-like price bar shown in the reference UI).
- Mobile-native app.

---

## 2. Functional Requirements

### 2.1 Sectors
The dashboard renders exactly six sectors with hard-coded constituent tickers:

| # | Sector (KR) | Sector (EN) |
|---|-------------|-------------|
| 1 | 반도체 | Semiconductor |
| 2 | 조선 | Shipbuilding |
| 3 | 방산 | Defense |
| 4 | 바이오 | Bio |
| 5 | 전력기기 | Power Equipment |
| 6 | 금융 | Finance |

Each sector card shows:
- Sector name + sector aggregate rise-rate (the average defined in §2.3).
- Headline/news snippet placeholder (static for v1).
- A ranked list of constituent stocks. Each row contains: stock name, current price, rise-rate %, trading value (거래대금), and a colored price bar indicating intraday range.

### 2.2 Stock Universe
A static JSON file (`server/config/sectors.json`) maps each sector to a list of stock codes (KRX 6-digit `shcode`). The list is editable without a deploy because it is loaded at server start and on SIGHUP.

### 2.3 Sorting Rules
1. **Sector score** = arithmetic mean of the rise-rates of the **top 3** stocks in that sector (by rise-rate, descending). If a sector has fewer than 3 stocks with quotes, average over whatever is available.
2. **Sector order**: sectors are sorted by sector score, descending.
3. **Stock order within a sector**: stocks are sorted by rise-rate, descending.
4. Ties are broken by stock code ascending (deterministic).
5. Sorting recomputes whenever any constituent stock's rise-rate changes.

### 2.4 Real-Time Behavior
- On open, the client receives a full snapshot of all sectors + stocks via REST.
- Subsequent updates arrive over WebSocket as per-stock quote deltas; the client patches the in-memory model and re-sorts.
- Newly updated rows briefly highlight (background flash, 300 ms) to mirror the reference UI's yellow highlight on the top-mover row.

---

## 3. Architecture

```
                +-----------------------+
                |   LS Securities API   |
                |  REST (OAuth token)   |
                |  WebSocket (quotes)   |
                +----------+------------+
                           |
                           v
        +------------------+--------------------+
        |              Backend (Node.js)         |
        |  - LS API client (auth, reconnect)     |
        |  - Quote aggregator + sector scorer    |
        |  - REST API (/sectors, /health)        |
        |  - WS hub (fan-out to browser clients) |
        |  - In-memory store (Map<shcode,Quote>) |
        +------------------+--------------------+
                           |
              REST (initial snapshot)
              WebSocket (delta stream)
                           |
                           v
                +----------+------------+
                |  Frontend (React)     |
                |  - Sector grid view   |
                |  - Sort + highlight   |
                |  - WS client w/ retry |
                +-----------------------+
```

### 3.1 Components

**Backend (Node.js, TypeScript)**
- `ls-client/`: Authenticates against the LS Open API, subscribes to real-time quote streams for the configured tickers, normalizes payloads.
- `aggregator/`: Maintains the latest quote per `shcode`, computes per-sector scores, emits change events.
- `http/`: Express server exposing REST endpoints.
- `ws/`: `ws` library hub that broadcasts deltas to all connected browsers.
- `config/`: `sectors.json` + env-driven secrets.

**Frontend (React + Vite + TypeScript)**
- `components/SectorGrid`, `SectorCard`, `StockRow`, `PriceBar`.
- `store/`: Zustand (or React Context + reducer) holding sectors and quotes.
- `services/api.ts`: REST snapshot fetch.
- `services/socket.ts`: WebSocket client with exponential backoff reconnect.
- `hooks/useSortedSectors.ts`: memoized selector implementing §2.3.

### 3.2 Tech Choices
- **Language**: TypeScript end-to-end for shared DTO types.
- **Frontend**: React 18, Vite, Zustand, Tailwind CSS (faster path to the dense card layout).
- **Backend**: Node 20, Express, `ws`, `axios`, `pino` for logs.
- **Shared package**: `packages/shared` for `Quote`, `Sector`, `WSMessage` types.
- **Process**: `pnpm` workspaces, monorepo.

---

## 4. Data Model

### 4.1 Shared Types
```ts
type Quote = {
  shcode: string;      // 6-digit KRX code
  name: string;        // Korean short name
  price: number;       // current price (KRW)
  changeRate: number;  // 등락률 in percent, signed
  tradingValue: number;// 거래대금 in KRW
  high: number;        // intraday high
  low: number;         // intraday low
  open: number;
  prevClose: number;
  ts: number;          // server-side last update epoch ms
};

type Sector = {
  id: string;          // e.g. "semiconductor"
  nameKo: string;
  nameEn: string;
  headline?: string;
  shcodes: string[];
  score: number;       // avg of top-3 changeRate
};

type Snapshot = {
  sectors: Sector[];
  quotes: Record<string, Quote>;
  serverTs: number;
};

type WSMessage =
  | { type: 'quote'; quote: Quote }
  | { type: 'sectorScores'; scores: Record<string, number> }
  | { type: 'heartbeat'; ts: number };
```

### 4.2 Storage
- No persistent database for v1. Everything is in-memory on the backend.
- `sectors.json` is the only durable configuration.

---

## 5. APIs

### 5.1 REST

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Liveness probe — returns `{ ok, lsConnected, clients }`. |
| GET | `/api/snapshot` | Full snapshot (sectors + latest quotes). Client uses this on initial load. |
| GET | `/api/sectors` | Sector metadata only (no quotes). |

### 5.2 WebSocket
- Path: `/ws`.
- Server → client messages match the `WSMessage` union above.
- Heartbeat: server emits `heartbeat` every 15 s; client disconnects after 30 s of silence.
- Client → server: no messages required for v1 (no subscriptions — every client gets all six sectors).

### 5.3 LS Securities API Usage
- **Auth**: OAuth2 client_credentials grant against `oauth2/token`. Tokens cached and refreshed before expiry.
- **Snapshot REST**: bulk current-quote endpoint (`t8407` or equivalent) called on server startup to populate the store immediately.
- **Real-time WS**: subscribe to KOSPI/KOSDAQ price streams (`S3_`/`K3_`) for each configured `shcode`. Reconnect with exponential backoff (1 s, 2 s, 4 s, … capped at 30 s).
- All LS credentials are environment variables: `LS_APP_KEY`, `LS_APP_SECRET`, `LS_BASE_URL`, `LS_WS_URL`.

---

## 6. Sorting & Aggregation Algorithm

Triggered on every quote update; debounced to at most once per 100 ms per sector to avoid thrash during burst updates.

```
on quote(q):
  store[q.shcode] = q
  sector = sectorOf(q.shcode)
  schedule recompute(sector)

recompute(sector):
  quotes = sector.shcodes.map(store[_]).filter(present)
  sorted = quotes.sort by changeRate desc, shcode asc
  top3  = sorted.slice(0, 3)
  sector.score = mean(top3.map(.changeRate))
  broadcast 'sectorScores' { sector.id: sector.score }
  broadcast 'quote' q
```

The **client** owns the final sector ordering: it sorts sectors by `score` desc on every state change. This keeps the server stateless w.r.t. UI order and lets multiple clients render identically from the same delta stream.

---

## 7. UI Specification

### 7.1 Layout
- Desktop (the primary target — see screenshot 2): a 4-column × 2-row grid (8 cards). For v1 we render 6 sectors in a 3 × 2 grid that adapts to viewport width.
- Each card: ~250 px wide, ~340 px tall, white background, rounded corners, subtle shadow, with a teal banner showing the sector name and its aggregate rise-rate.

### 7.2 Stock Row
- Two-line row per stock:
  - Line 1: stock name (left), rise-rate % colored red for positive / blue for negative (Korean convention).
  - Line 2: current price (left), trading value in 억 KRW (right).
- A horizontal price bar shows where the current price sits between intraday low and high.
- The single highest-rise stock in each sector is highlighted with a yellow background to match the reference UI.

### 7.3 Header / Footer
- Header: app title "TMA", current date/time, search input (non-functional in v1, present for parity).
- Footer: KOSPI/KOSDAQ index strip + nav tabs (마켓중심 selected, others disabled in v1).

### 7.4 Localization
- All in-app strings are Korean (matching the reference). Component code, docs, and logs are English.

---

## 8. Performance & Scaling

- Expected load: < 100 concurrent browser clients, < 60 tracked tickers (6 sectors × ~10 stocks). Trivial for a single Node process.
- WebSocket fan-out is O(clients × updates). Updates are coalesced server-side at 100 ms per sector, capping outbound bandwidth.
- In-memory store fits in well under 10 MB.
- For deployment, a single container behind a TLS-terminating reverse proxy is sufficient.

---

## 9. Reliability

- **LS WS reconnect**: exponential backoff, jitter, on reconnect re-subscribe to all tickers and re-issue a REST snapshot to backfill any missed data.
- **Token refresh**: scheduled 60 s before expiry; on 401 from any LS endpoint, force-refresh once before failing.
- **Client reconnect**: WebSocket client retries indefinitely with backoff; on each successful (re)connect it fetches `/api/snapshot` to reset state.
- **Health**: `/api/health` reports `lsConnected: false` when the upstream stream has been silent for > 10 s. Used by the reverse proxy / uptime monitor.

---

## 10. Security

- LS credentials only on the backend; never exposed to the browser.
- CORS: allowlist only the deployed frontend origin.
- Rate-limit `/api/snapshot` (e.g. 30 req/min per IP) since it's the only un-throttled REST endpoint.
- WSS (TLS) in production.
- No PII handled.

---

## 11. Deployment

- **Hosting (proposed)**: Single VPS or a small managed container (Fly.io / Railway / Render). Both backend (port 8080) and frontend static files served from the same origin to simplify CORS and WS routing.
- **Build**: `pnpm build` produces `apps/web/dist` (static) and `apps/server/dist` (compiled TS). The Node server statically serves the web bundle.
- **Env**: `.env` with `LS_APP_KEY`, `LS_APP_SECRET`, `LS_BASE_URL`, `LS_WS_URL`, `PORT`, `ALLOWED_ORIGIN`.
- **Public URL**: provisioned via the host's TLS subdomain (e.g. `tma-clone.fly.dev`) — submitted in the assignment email.

---

## 12. Repository Layout

```
trading-assignment/
├── apps/
│   ├── server/           # Node.js backend
│   │   ├── src/
│   │   │   ├── ls/       # LS API client + WS
│   │   │   ├── store/    # in-memory quote store + scorer
│   │   │   ├── http/     # Express routes
│   │   │   ├── ws/       # browser-facing WS hub
│   │   │   └── index.ts
│   │   └── package.json
│   └── web/              # React frontend
│       ├── src/
│       │   ├── components/
│       │   ├── hooks/
│       │   ├── services/
│       │   ├── store/
│       │   └── App.tsx
│       └── package.json
├── packages/
│   └── shared/           # shared TS types
├── config/
│   └── sectors.json
├── SYSTEM_DESIGN.md
├── README.md
└── package.json          # pnpm workspaces root
```

---

## 13. Milestones

| # | Milestone | Deliverable |
|---|-----------|-------------|
| 1 | Skeleton | Monorepo, shared types, empty REST + WS endpoints, static React grid with mock data. |
| 2 | LS integration | Auth, REST snapshot, WS quote subscription, in-memory store populated. |
| 3 | Real-time UI | Live updates flowing to browser; price bars and highlights working. |
| 4 | Sorting | §2.3 fully implemented and unit-tested. |
| 5 | Polish | Reconnect logic, error states, layout matching reference screenshots. |
| 6 | Deploy | Public URL live; submit. |

Deadline: **2026-06-04 23:59 KST**.

---

## 14. Open Questions

1. Which exact LS Open API endpoints/codes to subscribe to (`t8407`, `t1102`, `S3_`, `K3_`)? — to confirm against the LS developer portal once credentials are issued.
2. Exact constituent stocks for each sector — the reference uses themes (e.g. "MLCC", "양자컴퓨터") rather than the 6 broad sectors specified by the assignment, so we will curate a defensible list (4–6 large-cap names per sector) and document the choice in `sectors.json`.
3. Whether end-of-day (post-15:30 KST) the page should freeze with the closing values or display "장 마감" — defaulting to freeze + label.
