# panmae — Railway 배포 가이드

정적 PWA + Node API + **Railway MySQL** 단일 서비스.

- 배포 URL: https://panmae-production.up.railway.app
- 저장소: https://github.com/gmdcok-crypto/panmae

## MySQL 연결 (필수)

1. 같은 Railway 프로젝트에 **MySQL** 서비스가 있어야 합니다.
2. **panmae 앱 서비스** → Variables → **Add Variable Reference**로 MySQL 변수를 연결:

| 앱 Variables | MySQL Reference |
|--------------|-----------------|
| `MYSQLHOST` | MySQL `MYSQLHOST` 또는 `RAILWAY_PRIVATE_DOMAIN` |
| `MYSQLPORT` | `3306` |
| `MYSQLUSER` | `root` (또는 MySQL `MYSQLUSER`) |
| `MYSQLPASSWORD` | MySQL `MYSQLPASSWORD` / `MYSQL_ROOT_PASSWORD` |
| `MYSQLDATABASE` | `railway` (또는 MySQL `MYSQL_DATABASE`) |

또는 `MYSQL_URL` 하나만 Reference로 연결해도 됩니다.

3. 재배포 후 확인:
   - `https://panmae-production.up.railway.app/api/health` → `"db": true`
   - 앱 로그에 `[db] MySQL 연결 OK` 표시

앱 기동 시 테이블을 **직접 생성**합니다 (`companies`, `products`, `transactions`, `transaction_items`).
비어 있으면 UI와 동일한 샘플 데이터를 한 번 삽입합니다.

## 개발 → 배포

`main` push 시 자동 재배포:

```powershell
git add .
git commit -m "변경 내용"
git push origin main
```

## 확인

| URL | 기대 결과 |
|-----|-----------|
| `/` | ERP PWA |
| `/api/health` | `{"status":"ok","db":true,...}` |
| `/api/bootstrap` | 거래처·품목·전표 JSON |

## 문제 해결

| 증상 | 해결 |
|------|------|
| `db: false` / 데이터 로드 실패 | 앱에 MySQL Reference 변수 연결 |
| 헬스체크 실패 | Deployments 로그에서 `[db] 초기화 실패` 확인 |
| 외래키 삭제 오류 | 전표가 있는 거래처/품목은 먼저 전표 삭제 |
