# TMA — 마켓중심 Clone

Real-time stock-sector dashboard that mirrors the LS Securities TMA "Market Center" view. See [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) for the full design spec.

## Stack
- **Backend**: Node 20, Express, `ws`, TypeScript (pino logging)
- **Frontend**: React 18, Vite, Zustand, Tailwind CSS, TypeScript
- **Shared**: TypeScript types in `packages/shared`
- **Monorepo**: pnpm workspaces

## Layout
```
apps/
  server/        Express + WebSocket hub + mock quote feed + aggregator
  web/           React UI
packages/
  shared/        Quote / Sector / WSMessage types
config/
  sectors.json   Theme + constituent tickers (hot-reloadable)
```

## Run locally
```bash
pnpm install
pnpm dev            # runs both server (:8080) and web (:5173) in parallel
```
Then open http://localhost:5173. Vite proxies `/api` and `/ws` to the server.

Independent commands:
```bash
pnpm --filter @tma/server dev
pnpm --filter @tma/web dev
pnpm -r typecheck
```

## Deploy
The production server serves both the REST/WebSocket backend and the built React app from one process.

```bash
pnpm install --frozen-lockfile
pnpm build
PORT=8080 pnpm start
```

A Dockerfile is included for single-service deployment on Render/Railway/Fly/etc. The deployed URL can be tested with:

```bash
curl https://YOUR_URL/api/health
curl https://YOUR_URL/api/snapshot
```

## Sectors (per assignment spec)
6 sectors, configured in [config/sectors.json](config/sectors.json): 반도체 · 조선 · 방산 · 바이오 · 전력기기 · 금융.

## Quote source
Two interchangeable feeds emit `Quote` objects into the `Store`; everything downstream (REST, WS, ranking) is identical either way.

- **LS Securities live feed** (`apps/server/src/feed/ls.ts`) — used when `USE_LS=1`.
  - OAuth2 client-credentials token
  - `t8436` to classify each ticker as KOSPI/KOSDAQ
  - `t1102` for the initial REST snapshot per ticker
  - WebSocket `S3_`/`K3_` (주식체결) for real-time ticks, with token refresh + auto-reconnect
- **Mock feed** (`apps/server/src/feed/mock.ts`) — default fallback so the UI runs without credentials, and the automatic fallback if LS startup fails.

For this assignment submission, LS증권 credentials were not available from the company. The application therefore keeps the LS adapter implemented and deploys with the mock feed by default; if valid `LS_APP_KEY` / `LS_APP_SECRET` are provided, the same REST/WebSocket/sorting pipeline runs with LS live quotes by setting `USE_LS=1`.

To run against the live LS API, copy [apps/server/.env.example](apps/server/.env.example) to `apps/server/.env` and fill in:
```
USE_LS=1
LS_APP_KEY=…
LS_APP_SECRET=…
```
`/api/health` reports `lsConnected: true` once the live feed is connected. Issue credentials at https://openapi.ls-sec.co.kr.

## REST + WS contract
| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | `{ ok, lsConnected, clients, ts }` |
| `GET /api/snapshot` | Full `{ sectors, quotes, marketIndex, serverTs }` |
| `GET /api/sectors` | Sector metadata + current scores |
| `WS  /ws` | Snapshot on connect, then `quote` / `sectorScores` / `marketIndex` / `heartbeat` frames |

## Sorting (per spec §2.3)
- Stocks within a sector: by `changeRate` desc, ties broken by `shcode` asc.
- Sector score: arithmetic mean of the top-3 stocks' change-rates.
- Sector order in the grid: by sector score desc.
- Recompute is debounced server-side at 100 ms per sector. The client also re-sorts on every state change so multiple browsers render identically from the same delta stream.

## UI notes
- 4×2 sector grid (matches the photo). Each card: teal banner with sector name + score, news headline snippet, 4 ranked stock rows.
- Stock row: name + signed % (red ▲ for positive, blue ▼ for negative — KR convention), price + last-trade time, intraday price bar from low → high with current price marker, trading value in 억 KRW.
- The single highest-rise stock per sector is highlighted with the yellow `#FFEB8A` background to match the reference UI.
- Updated rows flash briefly (300 ms) on price change.
