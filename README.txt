STN Short-form Commerce - Screenshot Front-end Synced Version

열기 순서:
1. index.html : 고객용 숏폼커머스 쇼핑 페이지
2. product-landing.html : 제품 클릭 시 새창으로 열리는 상품/결제 테스트 랜딩
3. influencer-dashboard.html : 인플루언서 회원가입/로그인/코드/매출 대시보드

데모 계정:
- hyeho / 1234
- woojung / 1234
- jieun / 1234

테스트 방법:
1) index.html에서 상품 카드의 '제품 보기 / 구매' 클릭
2) product-landing.html 새창에서 결제 완료 테스트 클릭
3) influencer-dashboard.html에서 해당 코드로 로그인 후 매출 반영 확인

주의:
현재 버전은 프론트 MVP이므로 데이터는 브라우저 localStorage에 저장됩니다.
실제 서비스 오픈 시 회원 DB, 상품 DB, 주문 DB, PG 결제 API, 정산 DB를 연결해야 합니다.


[STARINTV Bulk Dashboard Ready Update]
- Integrated influencer accounts embedded in data.js: 387 accounts including admin woojung / 1234.
- Default password for influencer accounts: 1234.
- Admin login: woojung / 1234.
- Admin panel functions: browser seed, CSV download, CSV paste bulk import, account list.
- For production: replace localStorage with Firebase/Supabase/DB and add phone/email verification + settlement account approval.
