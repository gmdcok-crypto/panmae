# panmae ERP

매입·매출 관리 솔루션 (PWA). C# WinForms 감성의 클래식 ERP UI.

## 기능

- **홈 대시보드** — 이번 달 매출/매입, 미수금/미지급금, 최근 거래
- **기초정보** — 거래처관리, 품목관리 (등록/수정/삭제, 검색)
- **매출** — 매출관리(기간·거래처 조회, 합계), 매출등록(품목 라인 편집, 부가세 자동계산), 미수금 현황
- **매입** — 매입관리, 매입등록, 미지급금 현황
- **ERP 셸** — 사이드 트리 메뉴, MDI 탭, 상태바, F8 저장 단축키
- **PWA** — 오프라인 동작(Service Worker), 홈 화면 설치, 모바일 대응

데이터는 브라우저 localStorage에 저장됩니다 (오프라인 우선).

## 실행

```bash
npm start
```

브라우저에서 `http://localhost:3000` 을 열어주세요.

## 구조

```
public/
  index.html          # ERP 셸
  css/tokens.css      # 디자인 토큰 (색·간격·폰트 변수)
  css/erp.css         # ERP 스타일 (WinForms/Excel 그리드 감성)
  js/format.js        # 숫자·날짜 포맷 유틸
  js/store.js         # localStorage 데이터 스토어
  js/panels.js        # 화면(패널) 렌더러
  js/app.js           # 셸: 트리 메뉴·탭·상태바
  sw.js               # Service Worker
  manifest.webmanifest
server.js             # 정적 파일 서버
```
