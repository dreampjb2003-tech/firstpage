# 사장님계산기

빌드 도구 없이 HTML·CSS·자바스크립트만으로 만든 정적 사이트입니다. 기획서는 같은 폴더의 `PLAN.md`를 보세요.

## 내 컴퓨터에서 미리 보기

`index.html`을 더블클릭해도 열리지만, 메뉴 이동까지 실제처럼 확인하려면 이 폴더에서 아래 명령을 실행한 뒤 브라우저로 http://localhost:8000 에 접속하세요.

```bash
python3 -m http.server 8000
```

## 계산 검증

```bash
node tests/calculator.test.js
```

## 배포

폴더 전체를 Cloudflare Pages, Netlify, GitHub Pages 같은 정적 호스팅에 그대로 올리면 됩니다. 빌드 명령은 필요 없습니다.

## 공개 전 남은 할 일

1. 파일 전체에서 `[직접 작성 필요]`를 검색해 모두 채우기 (분홍색으로 표시된 곳) — 목록은 PLAN.md 3-3
2. `js/rates.js`의 모든 요율을 공식 고시와 대조하고 `verifiedDate`, `industrialVerified` 수정
3. `contact/index.html`의 `your-email@example.com`을 실제 이메일로 교체
4. 도메인 연결 후 모든 파일의 `https://example.com`을 실제 도메인으로 교체
5. 애드센스 승인 후 `ads.txt` 주석 해제, 각 페이지 `<head>`에 광고 스크립트 추가, `.ad-slot` 자리에 광고 단위 삽입

## 매년 할 일

1월에 `js/rates.js`의 숫자를 새해 기준으로 바꾸고, `tests/calculator.test.js`의 기준 금액도 함께 고친 뒤 테스트를 실행하세요. 화면 문구에 적힌 연도(2026)와 요율 표도 같이 바꿉니다.
