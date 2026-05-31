GRVN Admin MVP 적용 안내

1) 새로 추가된 파일
- admin.html : 관리자 접속/상품 등록 화면
- admin.js : 관리자 로그인, 상품 저장, 랜딩 미리보기, data.js용 코드 복사 로직

2) 수정된 파일
- data.js : admin.html에서 localStorage에 저장한 상품을 STN_PRODUCTS에 자동 병합하도록 수정
- styles.css : admin 전용 스타일 추가
- index.html / product-landing.html / influencer-dashboard.html : 관리자 메뉴 링크 추가

3) 관리자 접속
- URL: /admin.html
- 기본 관리자: mike / 0806
- 보조 관리자: woojung / 1234

4) 현재 MVP 작동 방식
- 상품 등록 데이터는 현재 브라우저 localStorage에 저장됩니다.
- 저장 즉시 같은 브라우저의 index.html 및 product-landing.html에 반영됩니다.
- 영상/상세 이미지는 실제 파일 업로드가 아니라 assets 경로 또는 외부 URL을 입력하는 방식입니다.
- 실제 운영형 공용 저장은 다음 단계에서 Cloudflare Workers + D1 + R2로 연결해야 합니다.

5) 배포 방법
- 압축을 풀어 현재 프로젝트 루트에 덮어쓰기
- VSCode에서 확인
- git add .
- git commit -m "Add GRVN admin product upload MVP"
- git push origin main
- Cloudflare Pages 자동 배포 확인
