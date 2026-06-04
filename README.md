# TMA 마켓중심 클론

실시간 섹터별 종목 시세를 보여주는 웹 대시보드입니다.

배포 주소: https://trading-assignment.onrender.com

## 기술 스택

- Frontend: React, Vite, TypeScript, Zustand, Tailwind CSS
- Backend: Node.js, Express, TypeScript, WebSocket
- Package Manager: pnpm workspace
- Deploy: Render, Docker

## 주요 기능

- 6개 섹터 대시보드
  - 반도체
  - 조선
  - 방산
  - 바이오
  - 전력기기
  - 금융
- 섹터별 종목 실시간 업데이트
- REST API 기반 초기 데이터 조회
- WebSocket 기반 시세 스트리밍
- 상승률 기준 섹터 및 종목 자동 정렬
- 장중 고가/저가 기준 가격 위치 바 표시

## 정렬 로직

섹터 점수는 해당 섹터에서 상승률이 높은 상위 3개 종목의 평균 상승률입니다.

```text
섹터 점수 = 상위 3개 종목 상승률 합계 / 3
```

화면 정렬은 아래 순서로 처리합니다.

1. 섹터는 섹터 점수가 높은 순서로 정렬
2. 섹터 내부 종목은 상승률이 높은 순서로 정렬
3. 상승률이 같은 경우 종목 코드 기준으로 정렬

## 데이터 소스

시세 데이터는 교체 가능한 Feed 구조로 구성했습니다.

```text
apps/server/src/feed/ls.ts
apps/server/src/feed/mock.ts
```

현재 배포본에서 사용하는 데이터 소스는 `MockFeed`입니다. 별도 외부 시세 API Key 없이도 REST API, WebSocket 실시간 갱신, 정렬 로직을 확인할 수 있도록 자체 Mock 실시간 Feed를 사용했습니다.

LS증권 API 연동 모듈도 함께 구현되어 있으며, 실제 LS증권 API 사용 시에는 아래 환경변수를 설정합니다.

```bash
USE_LS=1
LS_APP_KEY=...
LS_APP_SECRET=...
```

환경변수가 설정되면 백엔드는 `MockFeed` 대신 `LsFeed`를 사용합니다. 두 Feed는 같은 데이터 구조를 사용하므로 REST API, WebSocket, 정렬 로직은 동일하게 동작합니다.

## API

```text
GET /api/health
GET /api/snapshot
GET /api/sectors
WS  /ws
```

## 로컬 실행

```bash
pnpm install
pnpm dev
```

```text
Frontend: http://localhost:5173
Backend:  http://localhost:8080
```

## 빌드 실행

```bash
pnpm build
PORT=8080 pnpm start
```

## 배포

Render에서 Docker 기반 단일 서비스로 실행합니다.

```text
Dockerfile
render.yaml
```

## 상태 확인

```bash
curl https://trading-assignment.onrender.com/api/health
curl https://trading-assignment.onrender.com/api/snapshot
```

Mock Feed 모드에서는 `/api/health`의 `lsConnected` 값이 `false`로 표시됩니다.
