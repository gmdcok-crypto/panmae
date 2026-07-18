# panmae — Railway 배포 가이드

정적 PWA를 Node 서버(`server.js`)로 서빙하는 **단일 서비스**. 빌드/DB 불필요.

- 배포 URL: https://panmae-production.up.railway.app
- 저장소: https://github.com/gmdcok-crypto/panmae
- 빌더: **Nixpacks** (`railway.toml` 자동 적용)

## 최초 1회 세팅

1. https://railway.com → **New Project**
2. **Deploy from GitHub repo** → `gmdcok-crypto/panmae`
3. 서비스 설정:
   - **Root Directory**: *(비움)*
   - Builder: **Nixpacks** (자동)
   - Start Command: `npm start` (자동)
4. **Settings → Networking → Generate Domain**
   - 이미 `panmae-production.up.railway.app` 도메인 사용 중

## 개발 → 배포 흐름

`main` 브랜치에 push하면 Railway가 자동으로 재배포합니다.

```powershell
git add .
git commit -m "변경 내용"
git push origin main
```

푸시 후 Railway 대시보드의 **Deployments** 탭에서 진행 상황을 확인할 수 있습니다.

## 확인

| URL | 기대 결과 |
|-----|-----------|
| `https://panmae-production.up.railway.app/` | ERP PWA 화면 |
| `https://panmae-production.up.railway.app/api/health` | `{"status":"ok","service":"panmae","railway":true,...}` |

## 환경변수 (선택)

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `PORT` | 서버 포트 (Railway가 자동 주입) | 3000 |
| `HOST` | 바인딩 호스트 | 0.0.0.0 |

수동 설정 불필요 — Railway가 `PORT`를 자동으로 주입합니다.

## 데이터 저장

현재 데이터는 브라우저 **localStorage**에 저장됩니다 (서버 DB 없음).
추후 서버 DB가 필요하면 Railway MySQL/Postgres 추가 후 `server.js`에 API를 확장하세요.

## 문제 해결

| 증상 | 해결 |
|------|------|
| 502 / 헬스체크 실패 | `server.js`가 `process.env.PORT`, `0.0.0.0` 바인딩 사용하는지 확인 |
| 배포 안 됨 | GitHub 연결·`main` 브랜치 자동배포 설정 확인 |
| 빌드 오류 | Root Directory 비우고 Nixpacks 사용 |
