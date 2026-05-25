이 패키지는 기존 STN 숏폼 커머스 프론트 MVP를 실제 자동화 시스템으로 확장하기 위한 구성입니다.

핵심 파일:
1. index.html - 고객용 숏폼 쇼핑
2. product-landing.html - 상품 랜딩/결제 테스트
3. influencer-dashboard.html - 인플루언서/관리자 대시보드
4. docs/00_AUTOMATION_SYSTEM_GUIDE_KR.md - 전체 자동화 시스템 설명서
5. docs/01_DATABASE_SCHEMA.sql - 운영 DB 설계
6. docs/02_API_SPEC.md - API 설계
7. docs/03_OPERATION_WORKFLOW.md - 운영 워크플로우
8. backend/server.js - Node.js 자동화 서버 샘플
9. workflows/MAKE_ZAPIER_AUTOMATION.md - Make/Zapier 자동화 시나리오

현재 프론트는 그대로 열어볼 수 있고, 실제 서비스 오픈 시에는 backend/server.js 또는 Supabase/Firebase로 데이터 저장 구조를 연결하면 됩니다.
