# 티마 마켓중심 카피 페이지

더트레이딩 면접 과제로 만든 실시간 섹터별 종목 대시보드입니다.

배포 주소: https://trading-assignment.onrender.com

## 주요 기능

- 총 6개 섹터 표시
  - 반도체
  - 조선
  - 방산
  - 바이오
  - 전력기기
  - 금융
- React 프론트엔드
- NodeJS 백엔드
- REST API로 초기 데이터와 기타 데이터 제공
- WebSocket으로 실시간 시세 데이터 반영
- 티마 마켓중심 화면을 참고한 카드형 UI

## 정렬 방식

요구사항에 맞게 아래 방식으로 정렬합니다.

1. 각 섹터에서 상승률이 높은 종목 3개의 상승률 평균값을 계산합니다.
2. 이 평균값이 높은 순서대로 섹터를 정렬합니다.
3. 각 섹터 안의 종목은 상승률이 높은 순서대로 정렬합니다.

정렬 로직은 백엔드에서 계산하고, 프론트엔드에서도 수신한 데이터 기준으로 다시 정렬합니다.

## 시세 데이터

LS증권 API 연동 코드는 구현되어 있습니다.

- 파일: `apps/server/src/feed/ls.ts`
- `USE_LS=1`
- `LS_APP_KEY`
- `LS_APP_SECRET`

위 환경변수를 설정하면 LS증권 API 사용 모드로 실행됩니다.

다만 과제 진행 중 회사로부터 과제용 LS증권 API Key를 제공받지 못했기 때문에, 현재 배포본은 Mock 실시간 시세 데이터를 사용합니다. Mock 데이터도 WebSocket으로 계속 갱신되며, REST API와 정렬 로직은 LS API 사용 시와 같은 구조로 동작합니다.

## API

```text
GET /api/health
GET /api/snapshot
GET /api/sectors
WS  /ws
```

## 실행 방법

```bash
pnpm install
pnpm dev
```

프론트엔드: http://localhost:5173  
백엔드: http://localhost:8080

## 빌드 및 실행

```bash
pnpm build
PORT=8080 pnpm start
```

## 배포

Render에 Docker 기반으로 배포했습니다.

배포 설정 파일:

```text
Dockerfile
render.yaml
```

## 확인 방법

```bash
curl https://trading-assignment.onrender.com/api/health
curl https://trading-assignment.onrender.com/api/snapshot
```

`/api/health`에서 `ok: true`가 나오면 서버가 정상 동작 중입니다.

현재 배포본은 Mock 데이터 모드이므로 `lsConnected` 값은 `false`입니다.
