'use strict';

const ADMIN_SESSION_KEY = 'grvn_admin_session';
const ADMIN_PRODUCT_KEY = 'stn_admin_products';
const ADMIN_USERS = {
  mike: '0806',
  woojung: '1234'
};

let API_PRODUCTS = [];
const $ = id => document.getElementById(id);
const slugify = value => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9가-힣]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 90) || `product-${Date.now()}`;

function getApiBase() {
  return window.GRVN_API_BASE ||
    localStorage.getItem('grvn_api_base') ||
    localStorage.getItem('stn_api_base') ||
    '';
}

function normalizeApiProduct(apiProduct) {
  return {
    id: apiProduct.slug || apiProduct.id,
    slug: apiProduct.slug,
    category: apiProduct.category || '상품',
    brand: apiProduct.brand || '',
    name: apiProduct.name || '',
    originalPrice: apiProduct.original_price || 0,
    price: apiProduct.price || 0,
    benefitRate: apiProduct.original_price && apiProduct.price
      ? Math.round((1 - apiProduct.price / apiProduct.original_price) * 100)
      : 0,
    commission: 0.1,
    tag: `${apiProduct.brand || ''} 캠페인`,
    desc: apiProduct.description || '',
    options: ['상세페이지 기준 옵션 선택'],
    video: '',
    detailImage: apiProduct.detail_image_url || '',
    thumbnail: apiProduct.thumbnail_url || '',
    sourceUrl: '',
    sourceProductCode: '',
    campaign: `${slugify(apiProduct.brand || 'grvn')}_affiliate_2026`,
    defaultClip: '',
    defaultInfluencer: '',
    defaultAffiliate: '',
    createdAt: apiProduct.created_at || '',
    updatedAt: apiProduct.created_at || '',
    isApiProduct: true
  };
}

function toApiProductPayload(product) {
  return {
    id: product.id,
    slug: product.slug || product.id,
    category: product.category,
    brand: product.brand,
    name: product.name,
    originalPrice: product.originalPrice,
    price: product.price,
    stock: 100,
    thumbnail: product.detailImage,
    detailImage: product.detailImage,
    desc: product.desc,
    status: 'active'
  };
}

async function fetchAdminProductsFromApi() {
  const apiBase = getApiBase();
  if (!apiBase) return [];

  try {
    const res = await fetch(`${apiBase}/api/admin/products`);

    if (!res.ok) {
      throw new Error(`Admin products API failed: ${res.status}`);
    }

    const data = await res.json();

    if (data && data.success && Array.isArray(data.products)) {
      console.log('[GRVN ADMIN] API 상품 목록 로딩 성공:', data.products.length);
      return data.products.map(normalizeApiProduct);
    }
  } catch (err) {
    console.warn('[GRVN ADMIN] API 상품 목록 로딩 실패. localStorage 사용:', err);
  }

  return [];
}

async function saveAdminProductToApi(product) {
  const apiBase = getApiBase();

  if (!apiBase) {
    throw new Error('GRVN_API_BASE가 없습니다.');
  }

  const res = await fetch(`${apiBase}/api/admin/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      product: toApiProductPayload(product)
    })
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.detail || data.error || '상품 API 저장 실패');
  }

  return data.product;
}

function readAdminProducts() {
  try { return JSON.parse(localStorage.getItem(ADMIN_PRODUCT_KEY) || '[]'); }
  catch { return []; }
}
function writeAdminProducts(rows) {
  localStorage.setItem(ADMIN_PRODUCT_KEY, JSON.stringify(rows));
}
function allProducts() {
  const defaults = Array.isArray(STN_PRODUCTS) ? STN_PRODUCTS.filter(p => !p.isAdminProduct) : [];
  const admin = readAdminProducts();
  const map = new Map(defaults.map(p => [p.id, p]));

  API_PRODUCTS.forEach(p => {
    const key = p.slug || p.id;
    if (!key) return;
    map.set(key, { ...map.get(key), ...p, isApiProduct: true });
  });

  admin.forEach(p => {
    const key = p.slug || p.id;
    if (!key) return;
    map.set(key, { ...map.get(key), ...p, isAdminProduct: true });
  });

  return Array.from(map.values());
}
function showToast(msg) { toast(msg); }
function isLoggedIn() { return localStorage.getItem(ADMIN_SESSION_KEY) === 'ok'; }
async function showApp() {
  $('loginPanel')?.classList.add('hidden');
  $('adminApp')?.classList.remove('hidden');

  API_PRODUCTS = await fetchAdminProductsFromApi();

  renderList();
  updateExport();
  updatePreview();
}
function showLogin() {
  $('loginPanel')?.classList.remove('hidden');
  $('adminApp')?.classList.add('hidden');
}
function parseOptions(text) {
  return String(text || '')
    .split(/\n|,/)
    .map(v => v.trim())
    .filter(Boolean);
}
function getFormData() {
  const brand = $('brand').value.trim();
  const name = $('name').value.trim();
  const influencer = $('defaultInfluencer').value.trim();
  const aff = $('defaultAffiliate').value.trim().toUpperCase();
  const id = $('editingId').value || slugify(`${brand}-${influencer}-${name}`);
  const price = Number($('price').value || 0);
  const originalPrice = Number($('originalPrice').value || 0);
  const commissionPct = Number($('commission').value || 10);
  const benefitRate = Number($('benefitRate').value || (originalPrice && price ? Math.round((1 - price / originalPrice) * 100) : 0));
  const defaultClip = $('defaultClip').value.trim() || `${slugify(influencer)}_reels`;
  return {
    id,
    category: $('category').value.trim() || '상품',
    brand,
    name,
    originalPrice,
    price,
    benefitRate,
    commission: Math.max(0, commissionPct) / 100,
    tag: $('tag').value.trim() || `${influencer} 착용 · ${brand} 캠페인`,
    desc: $('desc').value.trim() || `${influencer} 인플루언서 숏폼과 연결된 ${brand} 어필리에이트 상품입니다.`,
    options: parseOptions($('options').value) || ['상세페이지 기준 옵션 선택'],
    video: $('video').value.trim(),
    detailImage: $('detailImage').value.trim(),
    sourceUrl: $('sourceUrl').value.trim(),
    sourceProductCode: $('sourceProductCode').value.trim(),
    campaign: $('campaign').value.trim() || `${slugify(brand)}_affiliate_2026`,
    defaultClip,
    defaultInfluencer: influencer,
    defaultAffiliate: aff,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isAdminProduct: true
  };
}
function validateProduct(p) {
  const missing = [];
  if (!p.brand) missing.push('브랜드명');
  if (!p.name) missing.push('상품명');
  if (!p.price) missing.push('판매가');
  if (!p.video) missing.push('숏폼 영상 경로');
  if (!p.detailImage) missing.push('상세 이미지 경로');
  if (!p.defaultInfluencer) missing.push('인플루언서명');
  if (!p.defaultAffiliate) missing.push('aff 코드');
  if (missing.length) throw new Error(`${missing.join(', ')} 입력이 필요합니다.`);
}
function setForm(p) {
  $('editingId').value = p.id || '';
  $('brand').value = p.brand || '';
  $('category').value = p.category || '';
  $('name').value = p.name || '';
  $('originalPrice').value = p.originalPrice || '';
  $('price').value = p.price || '';
  $('benefitRate').value = p.benefitRate || '';
  $('commission').value = Math.round((Number(p.commission || 0.1) * 100) * 10) / 10;
  $('sourceProductCode').value = p.sourceProductCode || '';
  $('desc').value = p.desc || '';
  $('options').value = Array.isArray(p.options) ? p.options.join('\n') : '';
  $('video').value = p.video || '';
  $('detailImage').value = p.detailImage || '';
  $('defaultClip').value = p.defaultClip || '';
  $('campaign').value = p.campaign || '';
  $('sourceUrl').value = p.sourceUrl || '';
  $('defaultInfluencer').value = p.defaultInfluencer || '';
  $('defaultAffiliate').value = p.defaultAffiliate || '';
  $('tag').value = p.tag || '';
  updatePreview();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function resetForm() {
  $('productForm').reset();
  $('editingId').value = '';
  $('commission').value = 10;
  updatePreview();
}
async function saveProduct(e) {
  e.preventDefault();

  try {
    const product = getFormData();
    validateProduct(product);

    try {
      const savedApiProduct = await saveAdminProductToApi(product);
      showToast('상품이 Supabase DB에 저장되었습니다.');

      API_PRODUCTS = await fetchAdminProductsFromApi();

      renderList();
      updateExport();

      setForm({
        ...product,
        id: savedApiProduct?.slug || product.id,
        slug: savedApiProduct?.slug || product.id
      });

      return;
    } catch (apiErr) {
      console.warn('[GRVN ADMIN] API 저장 실패. localStorage로 임시 저장:', apiErr);
    }

    const rows = readAdminProducts();
    const idx = rows.findIndex(p => p.id === product.id);

    if (idx >= 0) {
      rows[idx] = { ...rows[idx], ...product, updatedAt: new Date().toISOString() };
    } else {
      rows.unshift(product);
    }

    writeAdminProducts(rows);
    showToast('API 저장 실패로 브라우저 localStorage에 임시 저장되었습니다.');
    renderList();
    updateExport();
    setForm(product);
  } catch (err) {
    alert(err.message || '저장 중 오류가 발생했습니다.');
  }
}
function deleteProduct() {
  const id = $('editingId').value;
  if (!id) return showToast('삭제할 Admin 등록 상품을 먼저 선택하세요.');
  const rows = readAdminProducts();
  const target = rows.find(p => p.id === id);
  if (!target) return showToast('기본 샘플 상품은 이 화면에서 삭제하지 않습니다.');
  if (!confirm(`${target.name} 상품을 삭제할까요?`)) return;
  writeAdminProducts(rows.filter(p => p.id !== id));
  resetForm();
  renderList();
  updateExport();
  showToast('상품이 삭제되었습니다.');
}
function openLanding() {
  let p;
  try { p = getFormData(); validateProduct(p); }
  catch (err) { alert(err.message); return; }
  const params = new URLSearchParams({
    product: p.id,
    aff: p.defaultAffiliate,
    clip: p.defaultClip,
    utm_source: 'instagram',
    utm_medium: 'affiliate',
    utm_campaign: p.campaign,
    utm_content: `${p.defaultAffiliate.toLowerCase()}_${p.defaultClip}`
  });
  window.open(`product-landing.html?${params.toString()}`, '_blank', 'noopener,noreferrer');
}
function productCard(p) {
  const isAdmin = p.isAdminProduct || readAdminProducts().some(row => row.id === p.id);
  const link = `product-landing.html?product=${encodeURIComponent(p.id)}&aff=${encodeURIComponent(p.defaultAffiliate || 'STNDEMO')}&clip=${encodeURIComponent(p.defaultClip || 'clip')}&utm_source=instagram&utm_medium=affiliate&utm_campaign=${encodeURIComponent(p.campaign || 'grvn_shortform_commerce')}`;
  return `<article class="admin-product-card" data-id="${p.id}">
    <img src="${p.detailImage || 'assets/salon_detail_page.jpg'}" alt="" loading="lazy" onerror="this.style.display='none'" />
    <div>
      <b>${p.name}</b>
      <span>${p.brand} · ${p.defaultInfluencer || '-'} · ${p.defaultAffiliate || '-'}</span>
      <em>${money(p.price)} ${p.benefitRate ? `· ${p.benefitRate}%` : ''}</em>
      <div class="admin-card-actions">
        <button class="btn small" type="button" data-edit="${p.id}">${isAdmin ? '수정' : '복사 등록'}</button>
        <a class="btn small dark" href="${link}" target="_blank" rel="noopener">랜딩</a>
      </div>
    </div>
  </article>`;
}
function renderList() {
  const q = ($('adminSearch')?.value || '').trim().toLowerCase();
  const adminRows = readAdminProducts();
  const products = allProducts().filter(p => {
    const text = [p.brand, p.name, p.defaultInfluencer, p.defaultAffiliate, p.category].join(' ').toLowerCase();
    return !q || text.includes(q);
  });
  $('productList').innerHTML = products.length ? products.map(productCard).join('') : '<p class="notice">등록된 상품이 없습니다.</p>';
  const brands = new Set(products.map(p => p.brand).filter(Boolean));
  const influencers = new Set(products.map(p => p.defaultInfluencer).filter(Boolean));
  $('adminProductCount').textContent = adminRows.length;
  $('adminBrandCount').textContent = brands.size;
  $('adminInfluencerCount').textContent = influencers.size;
}
function updatePreview() {
  const video = $('video')?.value.trim();
  const img = $('detailImage')?.value.trim();
  if ($('videoPreview')) $('videoPreview').src = video || '';
  if ($('imagePreview')) $('imagePreview').src = img || '';
}
function updateExport() {
  const rows = readAdminProducts();
  const code = `// admin.html에서 등록한 상품 백업 / data.js STN_PRODUCTS 배열에 추가 가능\n${JSON.stringify(rows, null, 2)}`;
  if ($('exportCode')) $('exportCode').value = code;
}
async function copyExport() {
  updateExport();
  const text = $('exportCode').value;
  try { await navigator.clipboard.writeText(text); showToast('등록 상품 백업 코드가 복사되었습니다.'); }
  catch { prompt('아래 코드를 복사하세요.', text); }
}

function bindEvents() {
  $('adminLoginBtn')?.addEventListener('click', () => {
    const id = $('adminId').value.trim();
    const pw = $('adminPw').value.trim();
    if (ADMIN_USERS[id] === pw) {
      localStorage.setItem(ADMIN_SESSION_KEY, 'ok');
      showApp();
      showToast('관리자 로그인 완료');
    } else alert('관리자 계정을 확인하세요.');
  });
  $('logoutBtn')?.addEventListener('click', () => { localStorage.removeItem(ADMIN_SESSION_KEY); showLogin(); });
  $('productForm')?.addEventListener('submit', saveProduct);
  $('resetFormBtn')?.addEventListener('click', resetForm);
  $('deleteBtn')?.addEventListener('click', deleteProduct);
  $('previewLandingBtn')?.addEventListener('click', openLanding);
  $('exportBtn')?.addEventListener('click', copyExport);
  $('adminSearch')?.addEventListener('input', renderList);
  ['video', 'detailImage'].forEach(id => $(id)?.addEventListener('input', updatePreview));
  $('productList')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-edit]');
    if (!btn) return;
    const p = allProducts().find(row => row.id === btn.dataset.edit);
    if (p) setForm({ ...p, id: p.isAdminProduct ? p.id : '' });
  });
}

bindEvents();
if (isLoggedIn()) showApp(); else showLogin();
