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

## Quote source
The server runs a **mock feed** by default — it primes plausible KRW prices and emits tick deltas every ~700 ms so the UI shows live behaviour without LS credentials.

To switch to the real LS Securities feed, drop in an `LsFeed` implementation that emits `Quote` objects into the `Store` (same shape as `MockFeed`), wire it up in `apps/server/src/index.ts`, and set:
```
LS_APP_KEY=…
LS_APP_SECRET=…
LS_BASE_URL=…
LS_WS_URL=…
USE_LS=1
```

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
