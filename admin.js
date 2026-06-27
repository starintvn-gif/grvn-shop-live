'use strict';

const ADMIN_SESSION_KEY = 'grvn_admin_session';
const ADMIN_TOKEN_KEY = 'grvn_admin_token';
const ADMIN_PRODUCT_KEY = 'stn_admin_products';

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

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

function setAdminToken(token) {
  if (token) {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  }
}

function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

async function adminFetch(path, options = {}) {
  const apiBase = getApiBase() || 'https://api.grvn.shop';
  const token = getAdminToken();

  const headers = {
    ...(options.headers || {}),
    'Authorization': `Bearer ${token}`
  };

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers
  });

  if (res.status === 401) {
    clearAdminToken();
    showLogin();
    throw new Error('관리자 인증이 만료되었거나 필요합니다. 다시 로그인하세요.');
  }

  return res;
}

function normalizeApiProduct(apiProduct) {
  const fallbackProduct = Array.isArray(STN_PRODUCTS)
    ? STN_PRODUCTS.find(p => {
      const apiKey = apiProduct.slug || apiProduct.id;
      const staticKey = p.slug || p.id;
      return apiKey && staticKey && apiKey === staticKey;
    })
    : null;

  return {
    id: apiProduct.slug || apiProduct.id,
    slug: apiProduct.slug || apiProduct.id,
    supabaseId: apiProduct.id,

    category: apiProduct.category || fallbackProduct?.category || '상품',
    brand: apiProduct.brand || fallbackProduct?.brand || '',
    name: apiProduct.name || fallbackProduct?.name || '',

    originalPrice: apiProduct.original_price || fallbackProduct?.originalPrice || 0,
    price: apiProduct.price || fallbackProduct?.price || 0,
    benefitRate: apiProduct.benefit_rate || fallbackProduct?.benefitRate || (
      apiProduct.original_price && apiProduct.price
        ? Math.round((1 - apiProduct.price / apiProduct.original_price) * 100)
        : 0
    ),
    commission: Number(apiProduct.commission ?? fallbackProduct?.commission ?? 0.1),

    tag: apiProduct.tag || fallbackProduct?.tag || `${apiProduct.brand || fallbackProduct?.brand || ''} 캠페인`,
    desc: apiProduct.description || fallbackProduct?.desc || '',
    options: ['상세페이지 기준 옵션 선택'],

    video: apiProduct.video_url || apiProduct.videoUrl || fallbackProduct?.video || '',
    detailImage: apiProduct.detail_image_url || apiProduct.detailImage || fallbackProduct?.detailImage || '',
    thumbnail: apiProduct.thumbnail_url || apiProduct.thumbnail || apiProduct.detail_image_url || fallbackProduct?.thumbnail || fallbackProduct?.detailImage || '',

    sourceUrl: apiProduct.source_url || fallbackProduct?.sourceUrl || '',
    sourceProductCode: apiProduct.source_product_code || fallbackProduct?.sourceProductCode || '',
    campaign: apiProduct.campaign || fallbackProduct?.campaign || `${slugify(apiProduct.brand || fallbackProduct?.brand || 'grvn')}_affiliate_2026`,

    defaultClip: apiProduct.default_clip || fallbackProduct?.defaultClip || '',
    defaultInfluencer: apiProduct.default_influencer || fallbackProduct?.defaultInfluencer || '',
    defaultAffiliate: apiProduct.default_affiliate || fallbackProduct?.defaultAffiliate || '',

    createdAt: apiProduct.created_at || '',
    updatedAt: apiProduct.updated_at || apiProduct.created_at || '',
    isApiProduct: true
  };
}

function toApiProductPayload(product) {
  return {
    id: product.supabaseId || product.id,
    slug: product.slug || product.id,

    category: product.category,
    brand: product.brand,
    name: product.name,

    originalPrice: product.originalPrice,
    price: product.price,
    stock: product.stock || 100,

    thumbnail: product.thumbnail || product.detailImage,
    detailImage: product.detailImage,
    videoUrl: product.video,

    desc: product.desc,
    status: 'active',

    defaultInfluencer: product.defaultInfluencer,
    defaultAffiliate: product.defaultAffiliate,
    defaultClip: product.defaultClip,
    campaign: product.campaign,
    tag: product.tag,
    sourceUrl: product.sourceUrl,
    sourceProductCode: product.sourceProductCode,
    commission: product.commission,
    benefitRate: product.benefitRate
  };
}

async function fetchAdminProductsFromApi() {
  const apiBase = getApiBase();
  if (!apiBase) return [];

  try {
    const res = await adminFetch('/api/admin/products');

    if (!res.ok) {
      throw new Error(`Admin products API failed: ${res.status}`);
    }

    const data = await res.json();

    if (data && data.success && Array.isArray(data.products)) {
      console.log('[GRVN ADMIN] API 상품 목록 로딩 성공:', data.products.length);
      return data.products
        .filter(p => p.status !== 'inactive')
        .map(normalizeApiProduct);
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

  const res = await adminFetch('/api/admin/products', {
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

async function inactiveAdminProductToApi(productId) {
  const apiBase = getApiBase();

  if (!apiBase) {
    throw new Error('GRVN_API_BASE가 없습니다.');
  }

  if (!productId) {
    throw new Error('비활성화할 상품 ID가 없습니다.');
  }

  const res = await adminFetch('/api/admin/products/inactive', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      slug: productId
    })
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.detail || data.error || '상품 비활성화 API 실패');
  }

  return data.product;
}

async function saveAdminProductOptionsToApi(productId, options) {
  const apiBase = getApiBase();

  if (!apiBase) {
    throw new Error('GRVN_API_BASE가 없습니다.');
  }

  if (!productId) {
    throw new Error('옵션을 저장할 product_id가 없습니다.');
  }

  if (!Array.isArray(options) || !options.length) {
    throw new Error('저장할 옵션이 없습니다.');
  }

  const res = await adminFetch('/api/admin/product-options', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      product_id: productId,
      options
    })
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.detail || data.error || '상품 옵션 API 저장 실패');
  }

  return data.options;
}

function getOptionRowsFromForm() {
  const rows = Array.from(document.querySelectorAll('[data-option-row]'));

  const options = rows.map(row => {
    const optionName = row.querySelector('[data-option-name]')?.value?.trim() || '';
    const optionValue = row.querySelector('[data-option-value]')?.value?.trim() || '';
    const additionalPrice = Number(row.querySelector('[data-option-price]')?.value || 0);
    const stock = Number(row.querySelector('[data-option-stock]')?.value || 0);

    return {
      option_name: optionName || '기본 옵션',
      option_value: optionValue || '상세페이지 기준 옵션 선택',
      additional_price: Number.isFinite(additionalPrice) ? additionalPrice : 0,
      stock: Number.isFinite(stock) ? stock : 0
    };
  }).filter(option => option.option_name && option.option_value);

  return options.length ? options : [{
    option_name: '기본 옵션',
    option_value: '상세페이지 기준 옵션 선택',
    additional_price: 0,
    stock: 100
  }];
}

function syncOptionTextarea() {
  const textarea = $('options');
  if (!textarea) return;

  const options = getOptionRowsFromForm();

  textarea.value = options.map(option => {
    const priceText = Number(option.additional_price || 0) > 0
      ? ` +${option.additional_price}`
      : '';
    return `${option.option_name} - ${option.option_value}${priceText} / 재고 ${option.stock}`;
  }).join('\n');
}

function escapeAdminHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function createOptionRow(option = {}) {
  const optionName = option.option_name || option.optionName || option.name || '기본 옵션';
  const optionValue = option.option_value || option.optionValue || option.value || '상세페이지 기준 옵션 선택';
  const additionalPrice = option.additional_price ?? option.additionalPrice ?? 0;
  const stock = option.stock ?? 100;

  const div = document.createElement('div');
  div.className = 'option-row';
  div.setAttribute('data-option-row', '');
  div.style.cssText = 'display:grid;grid-template-columns:1fr 1.4fr 0.8fr 0.8fr auto;gap:8px;align-items:end';

  div.innerHTML = `
    <label class="field">옵션명
      <input type="text" data-option-name value="${escapeAdminHtml(optionName)}" placeholder="예: 컬러 / 사이즈 / 기본 옵션" />
    </label>

    <label class="field">옵션값
      <input type="text" data-option-value value="${escapeAdminHtml(optionValue)}" placeholder="예: 아이보리 / M / 상세페이지 기준 옵션 선택" />
    </label>

    <label class="field">추가금액
      <input type="number" data-option-price value="${Number(additionalPrice || 0)}" inputmode="numeric" placeholder="0" />
    </label>

    <label class="field">재고
      <input type="number" data-option-stock value="${Number(stock || 0)}" inputmode="numeric" placeholder="100" />
    </label>

    <button class="btn dark" type="button" data-remove-option style="min-width:72px">삭제</button>
  `;

  return div;
}

function addOptionRow(option = {}) {
  const optionRows = $('optionRows');
  if (!optionRows) return;

  optionRows.appendChild(createOptionRow(option));
  syncOptionTextarea();
}

function removeOptionRow(button) {
  const row = button.closest('[data-option-row]');
  const optionRows = $('optionRows');

  if (!row || !optionRows) return;

  const rows = optionRows.querySelectorAll('[data-option-row]');

  if (rows.length <= 1) {
    showToast('옵션은 최소 1개 이상 필요합니다.');
    return;
  }

  row.remove();
  syncOptionTextarea();
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
function isLoggedIn() {
  return localStorage.getItem(ADMIN_SESSION_KEY) === 'ok' && !!getAdminToken();
}
async function showApp() {
  $('loginPanel')?.classList.add('hidden');
  $('adminApp')?.classList.remove('hidden');

  $('adminOrdersSection')?.classList.remove('hidden');
  $('adminSettlementsSection')?.classList.remove('hidden');

  API_PRODUCTS = await fetchAdminProductsFromApi();

  renderList();
  updateExport();
  updatePreview();

  loadAdminOrders();
  loadAdminSettlements();

  $('adminOrdersSection')?.classList.remove('hidden');
  $('adminSettlementsSection')?.classList.remove('hidden');
}
function showLogin() {
  $('loginPanel')?.classList.remove('hidden');
  $('adminApp')?.classList.add('hidden');

  $('adminOrdersSection')?.classList.add('hidden');
  $('adminSettlementsSection')?.classList.add('hidden');
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
  const existingProduct = id
    ? allProducts().find(p => {
      const key = p.slug || p.id;
      return key === id || p.id === id || p.slug === id;
    })
    : null;
  const price = Number($('price').value || 0);
  const originalPrice = Number($('originalPrice').value || 0);
  const commissionPct = Number($('commission').value || 10);
  const benefitRate = Number($('benefitRate').value || (originalPrice && price ? Math.round((1 - price / originalPrice) * 100) : 0));
  const defaultClip = $('defaultClip').value.trim() || `${slugify(influencer)}_reels`;
  return {
    id,
    slug: existingProduct?.slug || id,
    supabaseId: existingProduct?.supabaseId || '',
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
  $('editingId').value = p.slug || p.id || '';
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
  const optionRows = $('optionRows');
  if (optionRows) {
    optionRows.innerHTML = '';

    const optionList = Array.isArray(p.options) && p.options.length
      ? p.options
      : [{
        option_name: '기본 옵션',
        option_value: '상세페이지 기준 옵션 선택',
        additional_price: 0,
        stock: 100
      }];

    optionList.forEach(option => {
      if (typeof option === 'string') {
        addOptionRow({
          option_name: '기본 옵션',
          option_value: option,
          additional_price: 0,
          stock: 100
        });
      } else {
        addOptionRow(option);
      }
    });

    syncOptionTextarea();
  }
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

  const optionRows = $('optionRows');
  if (optionRows) {
    optionRows.innerHTML = '';
    optionRows.appendChild(createOptionRow({
      option_name: '기본 옵션',
      option_value: '상세페이지 기준 옵션 선택',
      additional_price: 0,
      stock: 100
    }));
  }

  syncOptionTextarea();
  updatePreview();
}
async function saveProduct(e) {
  e.preventDefault();

  try {
    const product = getFormData();
    validateProduct(product);

    try {
      const savedApiProduct = await saveAdminProductToApi(product);

      const productUuid = savedApiProduct?.id || product.supabaseId;
      const options = getOptionRowsFromForm();

      if (productUuid) {
        await saveAdminProductOptionsToApi(productUuid, options);
      }

      showToast('상품과 옵션이 Supabase DB에 저장되었습니다.');

      API_PRODUCTS = await fetchAdminProductsFromApi();

      renderList();
      updateExport();

      setForm({
        ...product,
        id: savedApiProduct?.slug || product.slug || product.id,
        slug: savedApiProduct?.slug || product.slug || product.id,
        supabaseId: savedApiProduct?.id || product.supabaseId || ''
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
async function deleteProduct() {
  let id = $('editingId')?.value?.trim() || '';
  let target = null;

  if (id) {
    target = allProducts().find(p => {
      const key = p.slug || p.id;
      return key === id || p.id === id || p.slug === id;
    });
  }

  // 복사 등록 상태처럼 editingId가 비어 있어도,
  // 현재 폼에 들어있는 상품 정보로 비활성화 대상을 찾습니다.
  if (!target) {
    try {
      const formProduct = getFormData();
      const formKey = formProduct.slug || formProduct.id;

      if (formKey) {
        id = formKey;
        target = allProducts().find(p => {
          const key = p.slug || p.id;
          return key === formKey || p.id === formKey || p.slug === formKey;
        }) || formProduct;
      }
    } catch (err) {
      console.warn('[GRVN ADMIN] 현재 폼 상품 정보 확인 실패:', err);
    }
  }

  if (!id && !target) {
    return showToast('비활성화할 상품을 먼저 선택하거나, 복사 등록 후 상품 정보가 채워져 있어야 합니다.');
  }

  const productKey = target?.slug || target?.id || id;
  const productName = target?.name || productKey;

  if (!productKey) {
    return showToast('비활성화할 상품 ID를 찾을 수 없습니다.');
  }

  if (!confirm(`${productName} 상품을 비활성화할까요?\n\n비활성화하면 메인/상세 API에서는 노출되지 않고, Supabase DB에는 기록이 남습니다.`)) {
    return;
  }

  try {
    await inactiveAdminProductToApi(productKey);

    showToast('상품이 Supabase DB에서 비활성화되었습니다.');

    API_PRODUCTS = await fetchAdminProductsFromApi();

    resetForm();
    renderList();
    updateExport();
  } catch (apiErr) {
    console.warn('[GRVN ADMIN] API 비활성화 실패. localStorage 삭제로 fallback:', apiErr);

    const rows = readAdminProducts();
    const existsLocal = rows.some(p => {
      const key = p.slug || p.id;
      return key === productKey || p.id === productKey || p.slug === productKey;
    });

    if (!existsLocal) {
      return alert(apiErr.message || '상품 비활성화 중 오류가 발생했습니다.');
    }

    writeAdminProducts(rows.filter(p => {
      const key = p.slug || p.id;
      return key !== productKey && p.id !== productKey && p.slug !== productKey;
    }));

    resetForm();
    renderList();
    updateExport();
    showToast('API 비활성화 실패로 localStorage 상품만 삭제했습니다.');
  }
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
  const isAdmin = p.isAdminProduct || p.isApiProduct || readAdminProducts().some(row => row.id === p.id);
  const link = `product-landing.html?product=${encodeURIComponent(p.id)}&aff=${encodeURIComponent(p.defaultAffiliate || 'STNDEMO')}&clip=${encodeURIComponent(p.defaultClip || 'clip')}&utm_source=instagram&utm_medium=affiliate&utm_campaign=${encodeURIComponent(p.campaign || 'grvn_shortform_commerce')}`;
  return `<article class="admin-product-card" data-id="${p.slug || p.id}">
    <img src="${p.detailImage || 'assets/salon_detail_page.jpg'}" alt="" loading="lazy" onerror="this.style.display='none'" />
    <div>
      <b>${p.name}</b>
      <span>${p.brand} · ${p.defaultInfluencer || '-'} · ${p.defaultAffiliate || '-'}</span>
      <em>${money(p.price)} ${p.benefitRate ? `· ${p.benefitRate}%` : ''}</em>
      <div class="admin-card-actions">
        <button class="btn small" type="button" data-edit="${p.slug || p.id}">${isAdmin ? '수정' : '복사 등록'}</button>
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
  $('adminLoginBtn')?.addEventListener('click', async () => {
    const id = $('adminId').value.trim();
    const pw = $('adminPw').value.trim();

    const apiBase = getApiBase() || 'https://api.grvn.shop';

    try {
      const res = await fetch(`${apiBase}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id,
          password: pw
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success || !data.token) {
        throw new Error(data.error || '관리자 계정을 확인하세요.');
      }

      localStorage.setItem(ADMIN_SESSION_KEY, 'ok');
      setAdminToken(data.token);

      await showApp();

      $('adminOrdersSection')?.classList.remove('hidden');
      $('adminSettlementsSection')?.classList.remove('hidden');

      showToast('관리자 로그인 완료');
    } catch (err) {
      console.error('[GRVN ADMIN] 로그인 실패:', err);
      alert(err.message || '관리자 계정을 확인하세요.');
    }
  });

  $('logoutBtn')?.addEventListener('click', () => {
    clearAdminToken();
    showLogin();

    $('adminOrdersSection')?.classList.add('hidden');
    $('adminSettlementsSection')?.classList.add('hidden');
  });

  $('productForm')?.addEventListener('submit', saveProduct);
  $('resetFormBtn')?.addEventListener('click', resetForm);
  $('deleteBtn')?.addEventListener('click', deleteProduct);
  $('previewLandingBtn')?.addEventListener('click', openLanding);
  $('exportBtn')?.addEventListener('click', copyExport);
  $('adminSearch')?.addEventListener('input', renderList);

  $('addOptionBtn')?.addEventListener('click', () => {
    addOptionRow({
      option_name: '컬러',
      option_value: '',
      additional_price: 0,
      stock: 10
    });
  });

  $('syncOptionTextBtn')?.addEventListener('click', () => {
    syncOptionTextarea();
    showToast('옵션 텍스트가 반영되었습니다.');
  });

  $('optionRows')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-remove-option]');
    if (!btn) return;
    removeOptionRow(btn);
  });

  $('optionRows')?.addEventListener('input', () => {
    syncOptionTextarea();
  });

  ['video', 'detailImage'].forEach(id => $(id)?.addEventListener('input', updatePreview));
  $('productList')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-edit]');
    if (!btn) return;
    const p = allProducts().find(row => {
      const key = row.slug || row.id;
      return key === btn.dataset.edit || row.id === btn.dataset.edit || row.slug === btn.dataset.edit;
    });
    if (p) setForm({
      ...p,
      id: p.slug || p.id,
      slug: p.slug || p.id,
      supabaseId: p.supabaseId || ''
    });
  });
}

bindEvents();
if (isLoggedIn()) showApp(); else showLogin();

function adminMoney(value) {
  return `₩${Number(value || 0).toLocaleString()}`;
}

function adminDate(value) {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString('ko-KR');
  } catch {
    return value;
  }
}

function getAdminOrdersStore() {
  return window.__GRVN_ADMIN_ORDERS || [];
}

function setAdminOrdersStore(orders) {
  window.__GRVN_ADMIN_ORDERS = Array.isArray(orders) ? orders : [];
}

function openOrderDetail(orderNo) {
  const modal = document.getElementById('orderDetailModal');
  const body = document.getElementById('orderDetailBody');

  if (!modal || !body) {
    return;
  }

  const order = getAdminOrdersStore().find(row => row.order_no === orderNo);

  if (!order) {
    body.innerHTML = '<p class="notice">주문 정보를 찾을 수 없습니다.</p>';
    modal.classList.remove('hidden');
    return;
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const payments = Array.isArray(order.payments) ? order.payments : [];
  const firstPayment = payments[0] || {};

  const itemRows = items.length
    ? items.map(item => `
      <tr>
        <td>${escapeAdminHtml(item.product_name || '-')}</td>
        <td>${escapeAdminHtml(item.option_name || '-')}</td>
        <td>${escapeAdminHtml(item.option_value || '-')}</td>
        <td>${Number(item.qty || 0)}</td>
        <td>${adminMoney(item.total_price || 0)}</td>
      </tr>
    `).join('')
    : `
      <tr>
        <td colspan="5">상품 정보가 없습니다.</td>
      </tr>
    `;

  body.innerHTML = `
    <div class="order-detail-grid">
      <div class="order-detail-box">
        <b>주문번호</b>
        <span>${escapeAdminHtml(order.order_no || '-')}</span>
      </div>

      <div class="order-detail-box">
        <b>주문상태</b>
        <span>${getOrderStatusText(order.status)}</span>
      </div>

      <div class="order-detail-box">
        <b>구매자명</b>
        <span>${escapeAdminHtml(order.buyer_name || '-')}</span>
      </div>

      <div class="order-detail-box">
        <b>연락처</b>
        <span>${escapeAdminHtml(order.buyer_phone || '-')}</span>
      </div>

      <div class="order-detail-box">
        <b>이메일</b>
        <span>${escapeAdminHtml(order.buyer_email || '-')}</span>
      </div>

      <div class="order-detail-box">
        <b>인플루언서 코드</b>
        <span>${escapeAdminHtml(order.ref_code || '-')}</span>
      </div>

      <div class="order-detail-box">
        <b>결제금액</b>
        <span>${adminMoney(order.payment_total || 0)}</span>
      </div>

      <div class="order-detail-box">
        <b>예상 수수료</b>
        <span>${adminMoney(order.commission_amount || 0)}</span>
      </div>

      <div class="order-detail-box">
        <b>결제사</b>
        <span>${escapeAdminHtml(order.payment_provider || firstPayment.payment_provider || '-')}</span>
      </div>

      <div class="order-detail-box">
        <b>결제 ID</b>
        <span>${escapeAdminHtml(order.payment_id || firstPayment.payment_id || '-')}</span>
      </div>

      <div class="order-detail-box">
        <b>결제상태</b>
        <span>${getPaymentStatusText(order.payment_status || firstPayment.payment_status)}</span>
      </div>

      <div class="order-detail-box">
        <b>주문일시</b>
        <span>${adminDate(order.created_at)}</span>
      </div>
    </div>

    <div class="order-detail-box">
      <b>상품/옵션 정보</b>
      <table class="order-detail-items">
        <thead>
          <tr>
            <th>상품명</th>
            <th>옵션명</th>
            <th>옵션값</th>
            <th>수량</th>
            <th>금액</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>
    </div>

    <div class="order-detail-box">
      <b>원본 주문 데이터</b>
      <div class="order-detail-raw">${escapeAdminHtml(JSON.stringify(order.raw_payload || {}, null, 2))}</div>
    </div>
  `;

  modal.classList.remove('hidden');
}

function closeOrderDetail() {
  const modal = document.getElementById('orderDetailModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function getOrderStatusClass(status) {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'paid') return 'status-paid';
  if (normalized === 'pending') return 'status-pending';
  return 'status-failed';
}

function getOrderStatusText(status) {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'paid') return '결제완료';
  if (normalized === 'pending') return '결제대기';
  if (normalized === 'cancelled') return '취소';
  if (normalized === 'failed') return '실패';

  return status || '-';
}

function getPaymentStatusText(status) {
  const normalized = String(status || '').toUpperCase();

  if (normalized === 'DONE') return '결제완료';
  if (normalized === 'PAID') return '결제완료';
  if (normalized === 'PAYED') return '결제완료';
  if (normalized === 'CANCELLED') return '취소완료';
  if (normalized === 'CANCELED') return '취소완료';
  if (normalized === 'FAILED') return '결제실패';

  return '결제대기';
}

function getPaymentStatusClass(status) {
  const normalized = String(status || '').toUpperCase();

  if (normalized === 'DONE') return 'payment-paid';
  if (normalized === 'PAID') return 'payment-paid';
  if (normalized === 'PAYED') return 'payment-paid';
  if (normalized === 'CANCELLED') return 'payment-cancelled';
  if (normalized === 'CANCELED') return 'payment-cancelled';
  if (normalized === 'FAILED') return 'payment-failed';

  return 'payment-pending';
}

async function loadAdminOrders() {
  const tableBody = document.getElementById('adminOrdersTableBody');

  if (!tableBody) {
    return;
  }

  tableBody.innerHTML = `
    <tr>
      <td colspan="9">주문 내역을 불러오는 중입니다.</td>
    </tr>
  `;

  const apiBase =
    window.GRVN_API_BASE ||
    localStorage.getItem('grvn_api_base') ||
    localStorage.getItem('stn_api_base') ||
    'https://api.grvn.shop';

  let data;

  try {
    const res = await adminFetch('/api/admin/orders?limit=50');

    data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || '관리자 주문 조회 실패');
    }
  } catch (err) {
    console.error('[GRVN ADMIN] 주문 조회 실패:', err);

    tableBody.innerHTML = `
      <tr>
        <td colspan="9">주문 내역을 불러오지 못했습니다. Console을 확인하세요.</td>
      </tr>
    `;

    return;
  }

  const orders = Array.isArray(data.orders) ? data.orders : [];
  setAdminOrdersStore(orders);
  const paidOrders = orders.filter((order) => {
    const status = String(order.status || '').toLowerCase();
    return status === 'paid';
  });

  const pendingOrders = orders.filter((order) => {
    const status = String(order.status || '').toLowerCase();
    return status === 'pending';
  });

  const cancelledOrders = orders.filter((order) => {
    const status = String(order.status || '').toLowerCase();
    return status === 'cancelled' || status === 'canceled';
  });

  const totalPaymentAmount = paidOrders.reduce(
    (sum, order) => sum + Number(order.payment_total || 0),
    0
  );

  const totalCommissionAmount = paidOrders.reduce(
    (sum, order) => sum + Number(order.commission_amount || 0),
    0
  );

  const totalOrdersEl = document.getElementById('adminTotalOrders');
  const paidOrdersEl = document.getElementById('adminPaidOrders');
  const pendingOrdersEl = document.getElementById('adminPendingOrders');
  const totalPaymentEl = document.getElementById('adminTotalPayment');
  const totalCommissionEl = document.getElementById('adminTotalCommission');

  if (totalOrdersEl) totalOrdersEl.textContent = orders.length;
  if (paidOrdersEl) paidOrdersEl.textContent = paidOrders.length;
  if (pendingOrdersEl) pendingOrdersEl.textContent = pendingOrders.length;
  if (totalPaymentEl) totalPaymentEl.textContent = adminMoney(totalPaymentAmount);
  if (totalCommissionEl) totalCommissionEl.textContent = adminMoney(totalCommissionAmount);

  if (!orders.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9">아직 주문 내역이 없습니다.</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = orders.map((order) => {
    const statusClass = getOrderStatusClass(order.status);
    const statusText = getOrderStatusText(order.status);

    const paymentStatus = String(order.payment_status || '').toUpperCase();
    const orderStatus = String(order.status || '').toLowerCase();

    const canCancel =
      orderStatus === 'paid' &&
      paymentStatus === 'PAID';

    let actionHtml = '-';

    if (
      orderStatus === 'cancelled' ||
      orderStatus === 'canceled' ||
      paymentStatus === 'CANCELLED'
    ) {
      actionHtml = '<span class="muted">취소완료</span>';
    } else if (canCancel) {
      actionHtml = `
      <button
        class="btn danger small"
        type="button"
        data-cancel-order="${order.order_no || ''}"
      >
        결제취소
      </button>
    `;
    }

    return `
    <tr>
      <td>
        <button class="order-link" type="button" data-order-detail="${order.order_no || ''}">
          ${order.order_no || '-'}
        </button>
      </td>
      <td><span class="status-pill ${statusClass}">${statusText}</span></td>
      <td>${order.product_name || '-'}</td>
      <td>${adminMoney(order.payment_total || 0)}</td>
      <td>${adminMoney(order.commission_amount || 0)}</td>
      <td>${order.ref_code || '-'}</td>
      <td>
        <span class="payment-status ${getPaymentStatusClass(order.payment_status)}">
          ${getPaymentStatusText(order.payment_status)}
        </span>
      </td>
      <td>${adminDate(order.created_at)}</td>
      <td>${actionHtml}</td>
    </tr>
  `;
  }).join('');
}

function getSettlementStatusText(status) {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'paid') return '지급완료';
  if (normalized === 'ready') return '정산대기';
  if (normalized === 'pending') return '미정산';
  if (normalized === 'unsettled') return '미정산';

  return '미정산';
}

function getSettlementStatusClass(status) {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'paid') return 'settlement-paid';
  if (normalized === 'ready') return 'settlement-ready';
  if (normalized === 'pending') return 'settlement-unsettled';
  if (normalized === 'unsettled') return 'settlement-unsettled';

  return 'settlement-unsettled';
}

async function loadAdminSettlements() {
  const tableBody = document.getElementById('adminSettlementsTableBody');

  if (!tableBody) {
    return;
  }

  tableBody.innerHTML = `
    <tr>
      <td colspan="8">정산 데이터를 불러오는 중입니다.</td>
    </tr>
  `;

  const apiBase =
    window.GRVN_API_BASE ||
    localStorage.getItem('grvn_api_base') ||
    localStorage.getItem('stn_api_base') ||
    'https://api.grvn.shop';

  let data;

  try {
    const res = await adminFetch('/api/admin/settlements');
    data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || '관리자 정산 조회 실패');
    }
  } catch (err) {
    console.error('[GRVN ADMIN] 정산 조회 실패:', err);

    tableBody.innerHTML = `
      <tr>
        <td colspan="8">정산 데이터를 불러오지 못했습니다. Console을 확인하세요.</td>
      </tr>
    `;

    return;
  }

  console.log('[GRVN ADMIN] 정산 데이터 로딩 성공:', data);

  const settlements = Array.isArray(data.settlements) ? data.settlements : [];

  const totalInfluencers = settlements.length;

  const totalPaidOrders = settlements.reduce((sum, row) => {
    return sum + Number(row.paid_orders || row.paid_order_count || 0);
  }, 0);

  const totalSales = settlements.reduce((sum, row) => {
    return sum + Number(row.total_sales || 0);
  }, 0);

  const totalCommission = settlements.reduce((sum, row) => {
    return sum + Number(row.total_commission || 0);
  }, 0);

  const influencerCountEl = document.getElementById('settlementInfluencerCount');
  const paidOrdersEl = document.getElementById('settlementPaidOrders');
  const totalSalesEl = document.getElementById('settlementTotalSales');
  const totalCommissionEl = document.getElementById('settlementTotalCommission');

  if (influencerCountEl) influencerCountEl.textContent = totalInfluencers;
  if (paidOrdersEl) paidOrdersEl.textContent = totalPaidOrders;
  if (totalSalesEl) totalSalesEl.textContent = adminMoney(totalSales);
  if (totalCommissionEl) totalCommissionEl.textContent = adminMoney(totalCommission);

  if (!settlements.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8">아직 정산 대상 데이터가 없습니다.</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = settlements.map((row) => {
    const statusText = getSettlementStatusText(row.settlement_status);
    const statusClass = getSettlementStatusClass(row.settlement_status);

    return `
      <tr>
        <td><strong>${row.ref_code || '-'}</strong></td>
        <td>${row.influencer_name || '-'}</td>
        <td>${row.paid_orders || row.paid_order_count || 0}</td>
        <td>${adminMoney(row.total_sales || 0)}</td>
        <td>${adminMoney(row.total_commission || 0)}</td>
        <td>${adminDate(row.latest_order_at)}</td>
        <td><span class="settlement-status ${statusClass}">${statusText}</span></td>
        <td>
          ${String(row.settlement_status || '').toLowerCase() === 'paid'
        ? '<span class="muted">정산완료</span>'
        : `<button class="btn small primary" type="button" data-mark-settlement="${row.ref_code || ''}">정산확정</button>`
      }
        </td>
      </tr>
    `;
  }).join('');
}

async function markSettlementPaid(refCode) {
  if (!refCode) {
    alert('정산확정할 인플루언서 코드가 없습니다.');
    return;
  }

  const ok = confirm(`${refCode} 코드의 결제완료 주문을 정산완료 처리할까요?`);

  if (!ok) {
    return;
  }

  try {
    const res = await adminFetch('/api/admin/settlements/mark-paid', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ref_code: refCode,
        memo: '관리자 화면 정산확정'
      })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      console.error('[GRVN ADMIN] 정산확정 실패:', data);
      alert(`정산확정 실패: ${data.error || data.message || '알 수 없는 오류'}`);
      return;
    }

    alert(`${refCode} 정산확정이 완료되었습니다.`);

    await loadAdminSettlements();
  } catch (err) {
    console.error('[GRVN ADMIN] 정산확정 요청 오류:', err);
    alert('정산확정 요청 중 오류가 발생했습니다. Console을 확인하세요.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const refreshOrdersBtn = document.getElementById('refreshOrdersBtn');

  if (refreshOrdersBtn) {
    refreshOrdersBtn.addEventListener('click', loadAdminOrders);
  }

  const refreshSettlementsBtn = document.getElementById('refreshSettlementsBtn');

  if (refreshSettlementsBtn) {
    refreshSettlementsBtn.addEventListener('click', loadAdminSettlements);
  }
});

async function cancelAdminPayment(orderNo) {
  if (!orderNo) {
    alert('주문번호가 없습니다.');
    return;
  }

  const ok = confirm(`${orderNo} 주문을 결제취소 처리할까요?\n\n취소 후 해당 주문은 매출/정산에서 제외됩니다.`);

  if (!ok) {
    return;
  }

  const apiBase =
    window.GRVN_API_BASE ||
    localStorage.getItem('grvn_api_base') ||
    localStorage.getItem('stn_api_base') ||
    'https://api.grvn.shop';

  try {
    const res = await adminFetch('/api/payments/cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order_no: orderNo,
        reason: '관리자 화면 결제 취소'
      })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      console.error('[GRVN ADMIN] 결제취소 실패:', data);
      alert(`결제취소 실패: ${data.error || data.message || '알 수 없는 오류'}`);
      return;
    }

    alert('결제취소가 완료되었습니다.');

    await loadAdminOrders();
    await loadAdminSettlements();

  } catch (err) {
    console.error('[GRVN ADMIN] 결제취소 요청 오류:', err);
    alert('결제취소 요청 중 오류가 발생했습니다. Console을 확인하세요.');
  }
}

document.addEventListener('click', (event) => {
  const cancelBtn = event.target.closest('[data-cancel-order]');

  if (!cancelBtn) {
    return;
  }

  const orderNo = cancelBtn.getAttribute('data-cancel-order');

  cancelAdminPayment(orderNo);
});

document.addEventListener('click', (event) => {
  const detailBtn = event.target.closest('[data-order-detail]');

  if (detailBtn) {
    const orderNo = detailBtn.getAttribute('data-order-detail');
    openOrderDetail(orderNo);
    return;
  }

  const closeBtn = event.target.closest('[data-close-order-modal]');

  if (closeBtn) {
    closeOrderDetail();
  }
});

document.addEventListener('click', (event) => {
  const settlementBtn = event.target.closest('[data-mark-settlement]');

  if (!settlementBtn) {
    return;
  }

  const refCode = settlementBtn.getAttribute('data-mark-settlement');

  markSettlementPaid(refCode);
});