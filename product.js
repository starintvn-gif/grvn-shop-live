let product = getProduct(qs('product'));
const code = getActiveCode();
const qtyInput = document.getElementById('qtyInput');
const optionSelect = document.getElementById('optionSelect');
function getStaticProducts() {
  if (Array.isArray(window.STN_PRODUCTS)) {
    return window.STN_PRODUCTS;
  }

  if (typeof STN_PRODUCTS !== 'undefined' && Array.isArray(STN_PRODUCTS)) {
    return STN_PRODUCTS;
  }

  return [];
}

function normalizeApiProduct(apiProduct, fallbackProduct) {
  if (!apiProduct) {
    return fallbackProduct;
  }

  const fallback = fallbackProduct || {};

  return {
    ...fallback,
    ...apiProduct,

    // 기존 프론트에서 사용하는 필드명 유지
    id: fallback.id || apiProduct.slug || apiProduct.id,
    slug: apiProduct.slug || fallback.slug || fallback.id,
    name: apiProduct.name || fallback.name,
    brand: apiProduct.brand || fallback.brand,
    category: apiProduct.category || fallback.category,

    // Supabase 컬럼명과 기존 프론트 필드명 연결
    originalPrice: apiProduct.original_price ?? fallback.originalPrice,
    price: apiProduct.price ?? fallback.price,
    detailImage: apiProduct.detail_image_url || fallback.detailImage,
    thumbnail: apiProduct.thumbnail_url || fallback.thumbnail,
    desc: apiProduct.description || fallback.desc,

    // 상세페이지/영상/결제 로직에 필요한 필드 연결
    video: apiProduct.video_url || apiProduct.video || fallback.video || '',
    defaultClip: apiProduct.default_clip || fallback.defaultClip || apiProduct.slug || fallback.id || 'stn-shortform',
    defaultInfluencer: apiProduct.default_influencer || fallback.defaultInfluencer || '',
    defaultAffiliate: apiProduct.default_affiliate || fallback.defaultAffiliate || code,
    campaign: apiProduct.campaign || fallback.campaign || 'grvn_shortform_commerce',
    options: Array.isArray(apiProduct.options) && apiProduct.options.length
      ? apiProduct.options
      : (fallback.options || ['FREE']),
    commission: Number(apiProduct.commission ?? fallback.commission ?? 0.3),
    benefitRate: apiProduct.benefit_rate ?? fallback.benefitRate,
    sourceProductCode: apiProduct.source_product_code || fallback.sourceProductCode || ''
  };
}

async function loadProductDetailFromApi(slugOrId, fallbackProduct) {
  const apiBase =
    window.GRVN_API_BASE ||
    localStorage.getItem('grvn_api_base') ||
    localStorage.getItem('stn_api_base') ||
    '';

  if (!apiBase || !slugOrId) {
    console.log('[GRVN] 상품 상세 API base 없음. data.js 상품 사용');
    return fallbackProduct;
  }

  try {
    const res = await fetch(`${apiBase}/api/products/${encodeURIComponent(slugOrId)}`);

    if (!res.ok) {
      throw new Error(`Product detail API failed: ${res.status}`);
    }

    const data = await res.json();

    if (data && data.success && data.product) {
      console.log('[GRVN] API 상품 상세 로딩 성공:', data.product.slug || data.product.id);
      return normalizeApiProduct(data.product, fallbackProduct);
    }
  } catch (err) {
    console.warn('[GRVN] 상품 상세 API 연결 실패. data.js 상품 사용:', err);
  }

  return fallbackProduct;
}

async function createPendingOrder(product, selectedOption, qty = 1) {
  const apiBase =
    window.GRVN_API_BASE ||
    localStorage.getItem('grvn_api_base') ||
    localStorage.getItem('stn_api_base') ||
    'https://api.grvn.shop';

  const productSlug = product.slug || product.id;

  const payload = {
    product_slug: productSlug,
    option_name: selectedOption?.option_name || selectedOption?.optionName || '기본 옵션',
    option_value: selectedOption?.option_value || selectedOption?.optionValue || selectedOption?.value || '상세페이지 기준 옵션 선택',
    qty: Number(qty || 1),

    ref_code: getActiveCode ? getActiveCode() : (localStorage.getItem('stn_last_aff') || 'GRVN'),
    influencer_name: product.defaultInfluencer || product.default_influencer || '',

    buyer_name: '테스트',
    buyer_phone: '01000000000',
    buyer_email: 'test@example.com',

    page_url: location.href
  };

  const res = await fetch(`${apiBase}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    console.error('[GRVN] 주문 생성 실패:', data);
    alert('주문 생성에 실패했습니다. 콘솔을 확인해주세요.');
    return null;
  }

  console.log('[GRVN] 주문 생성 성공:', data);
  return data;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getOptionLabel(option) {
  if (typeof option === 'string') {
    return option;
  }

  const name = option.option_name || option.name || '옵션';
  const value = option.option_value || option.value || '';
  const addPrice = Number(option.additional_price || option.additionalPrice || 0);
  const stock = option.stock !== undefined && option.stock !== null
    ? Number(option.stock)
    : null;

  const priceText = addPrice > 0 ? ` / 추가 ${money(addPrice)}` : '';
  const stockText = Number.isFinite(stock) ? ` / 재고 ${stock}` : '';

  return `${name}${value ? ` - ${value}` : ''}${priceText}${stockText}`;
}

function getSelectedOption() {
  if (!optionSelect || !product) {
    return null;
  }

  const options = Array.isArray(product.options) && product.options.length
    ? product.options
    : ['FREE'];

  const selectedIndex = Number(optionSelect.value);

  if (Number.isInteger(selectedIndex) && options[selectedIndex]) {
    return options[selectedIndex];
  }

  return options[0] || null;
}

function getSelectedOptionAdditionalPrice() {
  const selected = getSelectedOption();

  if (!selected || typeof selected === 'string') {
    return 0;
  }

  return Number(selected.additional_price || selected.additionalPrice || 0);
}

function getSelectedOptionText() {
  const selected = getSelectedOption();

  if (!selected) {
    return 'FREE';
  }

  return getOptionLabel(selected);
}

function renderProductPage(product) {
  if (!product) {
    toast('상품 정보를 찾을 수 없습니다.');
    const title = document.getElementById('productTitle');
    if (title) title.textContent = '상품 정보를 찾을 수 없습니다.';
    return;
  }

  document.getElementById('productTitle').textContent = product.name;
  document.getElementById('productDesc').textContent = `${product.brand} · ${product.desc || ''}`;
  document.getElementById('priceText').textContent = money(product.price);

  const originalPriceEl = document.getElementById('originalPriceText');
  if (originalPriceEl && product.originalPrice) {
    originalPriceEl.textContent = `정상가 ${money(product.originalPrice)}`;
  }

  document.getElementById('affCode').textContent = code;

  const landingVideo = document.getElementById('landingVideo');
  if (landingVideo) {
    landingVideo.src = product.video || '';
    landingVideo.addEventListener('error', () => {
      console.warn('Video failed to load:', product.video);
      landingVideo.poster = product.detailImage || '';
    });
  }

  const detailImage = document.getElementById('detailImage');
  if (detailImage && product.detailImage) {
    detailImage.src = product.detailImage;
    detailImage.alt = `${product.brand} ${product.name} 상세페이지 이미지`;
    detailImage.addEventListener('error', () => {
      detailImage.src = 'assets/salon_detail_page.jpg';
      const caption = document.getElementById('detailCaption');
      if (caption) {
        caption.textContent = '상세 이미지 파일을 찾지 못해 기본 상세 이미지로 표시합니다. assets/detail_pages 경로를 확인하세요.';
      }
    });
  }

  document.title = `${product.name} / GRVN Affiliate Landing`;

  const clipId = qs('clip') || product.defaultClip || 'stn-shortform';
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText('detailCat1', product.category);
  setText('detailBrand', product.brand);
  setText('specBrand', product.brand);
  setText('specCategory', product.category);
  setText('specProductId', product.id);
  setText('specSourceCode', product.sourceProductCode || '-');
  setText('specOriginalPrice', product.originalPrice ? money(product.originalPrice) : '-');
  setText('specBenefitPrice', product.price ? money(product.price) : '-');
  setText('specBenefitRate', product.benefitRate ? `${product.benefitRate}%` : '-');
  setText('specClipId', clipId);
  setText('specCommission', `${Math.round((product.commission || 0.3) * 100)}%`);

  if (optionSelect) {
    const options = Array.isArray(product.options) && product.options.length
      ? product.options
      : ['FREE'];

    optionSelect.innerHTML = options.map((option, index) => {
      const label = getOptionLabel(option);
      const disabled = typeof option !== 'string' && Number(option.stock) <= 0 ? ' disabled' : '';

      return `<option value="${index}"${disabled}>${escapeHtml(label)}</option>`;
    }).join('');
  }

  const detailCaption = document.getElementById('detailCaption');
  if (detailCaption) {
    detailCaption.textContent = `${product.defaultInfluencer || '인플루언서'} 영상 속 LOOK 상품입니다. ${product.name} 상세 이미지가 GRVN 내부에 직접 표시되며, 옵션 선택 후 이 페이지에서 바로 결제합니다.`;
  }

  updateSummary();
}

function updateSummary() {
  if (!product) return;

  const qty = Math.max(1, Number(qtyInput.value) || 1);
  const optionAdditionalPrice = getSelectedOptionAdditionalPrice();
  const unitPrice = Number(product.price || 0) + optionAdditionalPrice;
  const subtotal = unitPrice * qty;
  const commission = Math.round(subtotal * (product.commission || 0.3));

  document.getElementById('subtotal').textContent = money(subtotal);
  document.getElementById('commission').textContent = money(commission);
  document.getElementById('total').textContent = money(subtotal);
}

if (qtyInput) {
  qtyInput.addEventListener('input', updateSummary);
}

if (optionSelect) {
  optionSelect.addEventListener('change', updateSummary);
}

async function requestTossPayment() {
  const checkoutBtn = document.getElementById('checkoutBtn');

  try {
    if (!product) {
      toast('상품 정보를 찾을 수 없습니다.');
      return;
    }

    if (checkoutBtn) {
      checkoutBtn.disabled = true;
      checkoutBtn.textContent = '결제창 여는 중...';
    }

    if (!window.TossPayments) {
      throw new Error('토스페이먼츠 SDK가 로드되지 않았습니다. product-landing.html의 Toss SDK script를 확인하세요.');
    }

    if (!window.TOSS_CLIENT_KEY || window.TOSS_CLIENT_KEY.includes('여기에')) {
      throw new Error('TOSS_CLIENT_KEY가 설정되지 않았습니다. product-landing.html에 토스 테스트 clientKey를 입력하세요.');
    }

    const qty = Math.max(1, Number(qtyInput.value) || 1);
    const selectedOption = getSelectedOption();
    const optionAdditionalPrice = getSelectedOptionAdditionalPrice();
    const unitPrice = Number(product.price || 0) + optionAdditionalPrice;
    const amount = unitPrice * qty;

    if (!amount || amount < 100) {
      throw new Error('결제금액이 올바르지 않습니다.');
    }

    const params = new URLSearchParams(window.location.search);
    const productSlug = product.slug || product.id || params.get('product') || 'grvn-product';
    const affCode = params.get('aff') || localStorage.getItem('stn_last_aff') || code || 'GRVN';

    const orderId =
      'GRVN-' +
      Date.now() +
      '-' +
      Math.random().toString(36).slice(2, 8).toUpperCase();

    const orderName = product.name || 'GRVN 상품';

    sessionStorage.setItem('grvn_last_order', JSON.stringify({
      orderId,
      amount,
      orderName,
      productSlug,
      affCode,
      qty,
      option: getSelectedOptionText(),
      createdAt: new Date().toISOString()
    }));

    const tossPayments = TossPayments(window.TOSS_CLIENT_KEY);

    const payment = tossPayments.payment({
      customerKey: 'GRVN_GUEST_' + Date.now()
    });

    await payment.requestPayment({
      method: 'CARD',
      amount: {
        currency: 'KRW',
        value: amount
      },
      orderId,
      orderName,
      successUrl: window.location.origin + '/payment-success.html',
      failUrl: window.location.origin + '/payment-fail.html',
      customerEmail: '',
      customerName: ''
    });

  } catch (error) {
    console.error('[GRVN] Toss 결제창 호출 실패:', error);
    alert(error?.message || '결제창 호출 중 문제가 발생했습니다.');

    if (checkoutBtn) {
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = '구매하기';
    }
  }
}

const checkoutBtn = document.getElementById('checkoutBtn');

if (checkoutBtn) {
  checkoutBtn.addEventListener('click', requestTossPayment);
}

async function initProductPage() {
  const productKey = qs('product');
  const fallbackProduct = product || getStaticProducts().find(p =>
    p.id === productKey ||
    p.slug === productKey
  );

  product = await loadProductDetailFromApi(productKey, fallbackProduct);
  renderProductPage(product);
}

initProductPage();