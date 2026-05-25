/* =============================================================
   GRVN Influencer Dashboard — dashboard.js
   -------------------------------------------------------------
   [관리자 계정]  ID: mike  /  PW: 0806
   -------------------------------------------------------------
   [백엔드 연동 준비 — API_LAYER]
   현재는 localStorage + data.js(STN_INFLUENCERS) 기반 MVP입니다.
   Supabase 연동 시 API_LAYER 객체의 메서드 내부만 교체하면
   모든 UI 로직은 그대로 재사용 가능합니다.

   교체 대상:
     API_LAYER.getAccounts()  → Supabase: influencers 테이블 SELECT
     API_LAYER.saveAccounts() → Supabase: influencers 테이블 UPSERT
     API_LAYER.getEvents()    → Supabase: affiliate_tracking 테이블 SELECT
     API_LAYER.login()        → Supabase Auth 로그인 검증
     API_LAYER.logout()       → Supabase Auth signOut
   ============================================================= */

'use strict';

/* ─── 상수 ─────────────────────────────────────────────────── */
const ADMIN_ID = 'mike';
const ADMIN_PW = '0806';

const LS_USER  = 'grvn_current_user';
const LS_ACCTS = 'grvn_influencer_accounts';

/* ─── DOM 셀렉터 & 유틸 ─────────────────────────────────────── */
let currentUserId = localStorage.getItem(LS_USER) || '';
const $ = id => document.getElementById(id);

function normalizeCode(v) {
  return String(v || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
}
function makeLink(code) {
  return `${location.origin}${location.pathname.replace(/influencer-dashboard\.html$/, '')}index.html?aff=${encodeURIComponent(code)}`;
}
function isAdminAccount(acc) { return !!(acc && acc.isAdmin); }
function csvEscape(v) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }
function money(n) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(Number(n) || 0);
}

/* ─── CSV 파서 ──────────────────────────────────────────────── */
function parseCsvLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
    else if (ch === '"') { q = !q; }
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/* =============================================================
   API_LAYER — 백엔드 추상화 레이어
   MVP: localStorage 기반
   Supabase 전환 시 각 메서드 내부만 교체
   ============================================================= */
const API_LAYER = {

  /* [Supabase 전환 시] → influencers 테이블 SELECT */
  getAccounts() {
    let base = {};
    if (typeof STN_INFLUENCERS !== 'undefined') base = { ...STN_INFLUENCERS };
    try {
      const stored = JSON.parse(localStorage.getItem(LS_ACCTS) || '{}');
      Object.assign(base, stored);
    } catch { /* ignore */ }
    return base;
  },

  /* [Supabase 전환 시] → influencers 테이블 UPSERT */
  saveAccounts(accounts) {
    const base = typeof STN_INFLUENCERS !== 'undefined' ? STN_INFLUENCERS : {};
    const delta = {};
    for (const [id, acc] of Object.entries(accounts)) {
      if (JSON.stringify(base[id]) !== JSON.stringify(acc)) delta[id] = acc;
    }
    localStorage.setItem(LS_ACCTS, JSON.stringify(delta));
  },

  /* [Supabase 전환 시] → affiliate_tracking 테이블 SELECT */
  getEvents() {
    return typeof stnRead === 'function' ? stnRead() : [];
  },

  /* [Supabase 전환 시] → Supabase Auth 로그인 */
  login(id, pw) {
    const accounts = this.getAccounts();
    return (accounts[id] && accounts[id].pw === pw) ? accounts[id] : null;
  },

  /* [Supabase 전환 시] → Supabase Auth signOut */
  logout() {
    localStorage.removeItem(LS_USER);
    currentUserId = '';
  }
};

/* ─── 계정 헬퍼 ─────────────────────────────────────────────── */
function account() { return API_LAYER.getAccounts()[currentUserId]; }

/* ─── 전체 계정 CSV 내보내기 (관리자용) ─────────────────────── */
function accountsToCsv() {
  const header = ['id', 'pw', 'name', 'handle', 'code', 'tier', 'category', 'item', 'url', 'followers', 'coupon'];
  const accounts = API_LAYER.getAccounts();
  return [
    '\ufeff' + header.join(','),
    ...Object.entries(accounts).map(([id, a]) =>
      header.map(h => csvEscape(h === 'id' ? id : a[h])).join(','))
  ].join('\n');
}

/* ─── CSV 일괄 등록 ─────────────────────────────────────────── */
function importAccountsCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return 0;
  const header = parseCsvLine(lines[0]).map(h => h.replace(/^\ufeff/, '').trim());
  const accounts = API_LAYER.getAccounts();
  let count = 0;
  lines.slice(1).forEach(line => {
    const vals = parseCsvLine(line);
    const row = {};
    header.forEach((h, i) => row[h] = vals[i] || '');
    if (!row.id) return;
    accounts[row.id] = {
      pw:        row.pw        || '1234',
      name:      row.name      || row.id,
      handle:    row.handle    || '',
      code:      row.code      || row.id.toUpperCase(),
      tier:      row.tier      || '',
      category:  row.category  || '',
      item:      row.item      || '',
      url:       row.url       || '',
      followers: row.followers || '',
      coupon:    row.coupon    || '',
      isAdmin:   row.id === ADMIN_ID
    };
    count++;
  });
  API_LAYER.saveAccounts(accounts);
  return count;
}

/* =============================================================
   UI 렌더링
   ============================================================= */
function renderAdminPanel() {
  const acc   = account();
  const panel = $('adminPanel');
  if (!panel) return;
  if (!isAdminAccount(acc)) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');

  const accounts = API_LAYER.getAccounts();
  const rows = Object.entries(accounts)
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  $('adminAccountRows').innerHTML = rows.map(([id, a]) =>
    `<tr>
      <td>${id}</td>
      <td>${a.name      || '-'}</td>
      <td>${a.tier      || '-'}</td>
      <td>${a.category  || '-'}</td>
      <td>${a.code      || '-'}</td>
      <td>${a.item      || '-'}</td>
    </tr>`
  ).join('');
}

function showDashboard() {
  const acc = account();
  if (!acc) {
    $('loginPanel').classList.remove('hidden');
    $('dashboardPanel').classList.add('hidden');
    return;
  }
  $('loginPanel').classList.add('hidden');
  $('dashboardPanel').classList.remove('hidden');

  $('userName').textContent   = acc.name;
  $('myCode').textContent     = acc.code;
  $('myLinkText').textContent = makeLink(acc.code);

  const events     = API_LAYER.getEvents();
  const rows       = events.filter(r =>
    String(r.code).toUpperCase() === String(acc.code).toUpperCase() || isAdminAccount(acc));
  const clicks     = rows.filter(r => r.type === 'click').length;
  const orders     = rows.filter(r => r.type === 'order');
  const revenue    = orders.reduce((a, r) => a + (Number(r.amount)     || 0), 0);
  const commission = orders.reduce((a, r) => a + (Number(r.commission) || 0), 0);

  $('statClicks').textContent     = clicks;
  $('statOrders').textContent     = orders.length;
  $('statRevenue').textContent    = money(revenue);
  $('statCommission').textContent = money(commission);

  $('eventRows').innerHTML = rows.slice().reverse().map(r =>
    `<tr>
      <td>${new Date(r.createdAt).toLocaleString('ko-KR')}</td>
      <td>${r.type === 'order' ? '주문' : '클릭'}</td>
      <td>${r.productName || r.productId || '-'}</td>
      <td>${r.amount ? money(r.amount) : '-'}</td>
    </tr>`
  ).join('') || '<tr><td colspan="4">아직 기록된 이벤트가 없습니다.</td></tr>';

  renderAdminPanel();
}

/* =============================================================
   이벤트 리스너
   ============================================================= */

/* 로그인 */
$('loginBtn')?.addEventListener('click', () => {
  const id  = $('loginId').value.trim();
  const pw  = $('loginPw').value;
  const acc = API_LAYER.login(id, pw);
  if (acc) {
    currentUserId = id;
    localStorage.setItem(LS_USER, id);
    toast('로그인되었습니다.');
    showDashboard();
  } else {
    toast('아이디 또는 비밀번호를 확인하세요.');
  }
});

/* 신규 회원가입 */
$('signupBtn')?.addEventListener('click', () => {
  const name   = $('signupName').value.trim();
  const handle = $('signupHandle').value.trim();
  const id     = $('signupId').value.trim();
  const pw     = $('signupPw').value;
  let   code   = normalizeCode($('signupCode').value || id || handle);

  if (!name || !id || pw.length < 4) {
    toast('이름, 아이디, 4자 이상 비밀번호를 입력하세요.');
    return;
  }
  const accounts = API_LAYER.getAccounts();
  if (accounts[id]) { toast('이미 존재하는 아이디입니다.'); return; }
  if (!code) code = `GRVN${Date.now().toString().slice(-5)}`;

  accounts[id] = { name, handle, pw, code };
  API_LAYER.saveAccounts(accounts);
  currentUserId = id;
  localStorage.setItem(LS_USER, id);
  toast('회원가입과 코드 생성이 완료되었습니다.');
  showDashboard();
});

/* 로그아웃 */
$('logoutBtn')?.addEventListener('click', () => {
  API_LAYER.logout();
  $('loginPanel').classList.remove('hidden');
  $('dashboardPanel').classList.add('hidden');
  toast('로그아웃되었습니다.');
});

/* 판매 링크 복사 */
$('copyMyLink')?.addEventListener('click', () => {
  const acc = account();
  if (acc) {
    navigator.clipboard?.writeText(makeLink(acc.code))
      .then(() => toast('내 판매 링크가 복사되었습니다.'));
  }
});

/* Affiliate 코드 변경 */
$('changeCodeBtn')?.addEventListener('click', () => {
  const newCode = normalizeCode($('newCode').value);
  if (!newCode) { toast('새 코드를 입력하세요.'); return; }
  const accounts = API_LAYER.getAccounts();
  accounts[currentUserId].code = newCode;
  API_LAYER.saveAccounts(accounts);
  toast('Affiliate 코드가 변경되었습니다.');
  showDashboard();
});

/* 이벤트 CSV 다운로드 */
$('exportCsv')?.addEventListener('click', () => {
  const acc    = account();
  const events = API_LAYER.getEvents();
  const rows   = events.filter(r =>
    String(r.code).toUpperCase() === String(acc.code).toUpperCase() || isAdminAccount(acc));
  const header = ['createdAt', 'type', 'code', 'productId', 'productName', 'qty', 'amount', 'commission'];
  const csv = [
    header.join(','),
    ...rows.map(r => header.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `grvn_affiliate_${acc.code}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
});

/* 전체 계정 CSV 다운로드 (관리자) */
$('downloadAccountsCsv')?.addEventListener('click', () => {
  const blob = new Blob([accountsToCsv()], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'grvn_all_influencer_accounts.csv';
  a.click();
  URL.revokeObjectURL(a.href);
});

/* 기본 계정 브라우저 등록 (관리자) */
$('seedAccountsBtn')?.addEventListener('click', () => {
  if (typeof STN_INFLUENCERS !== 'undefined') {
    localStorage.setItem(LS_ACCTS, JSON.stringify(STN_INFLUENCERS));
    toast('전체 기본 계정을 브라우저에 등록했습니다.');
    renderAdminPanel();
  } else {
    toast('data.js의 STN_INFLUENCERS를 찾을 수 없습니다.');
  }
});

/* 추가 계정 초기화 (관리자) */
$('clearCustomAccounts')?.addEventListener('click', () => {
  localStorage.removeItem(LS_ACCTS);
  toast('브라우저 추가 계정을 초기화했습니다. 기본 계정은 유지됩니다.');
  renderAdminPanel();
});

/* CSV 일괄 등록 (관리자) */
$('bulkImportBtn')?.addEventListener('click', () => {
  const n = importAccountsCsv($('bulkCsv').value);
  toast(`${n}개 계정을 등록/갱신했습니다.`);
  renderAdminPanel();
});

/* ─── 초기 실행 ─────────────────────────────────────────────── */
showDashboard();
