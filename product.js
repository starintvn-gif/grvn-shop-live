const product = getProduct(qs('product'));
const code = getActiveCode();
const qtyInput = document.getElementById('qtyInput');
const optionSelect = document.getElementById('optionSelect');

document.getElementById('productTitle').textContent = product.name;
document.getElementById('productDesc').textContent = `${product.brand} · ${product.desc}`;
document.getElementById('priceText').textContent = money(product.price);
const originalPriceEl = document.getElementById('originalPriceText');
if (originalPriceEl && product.originalPrice) originalPriceEl.textContent = `정상가 ${money(product.originalPrice)}`;
document.getElementById('affCode').textContent = code;
const landingVideo = document.getElementById('landingVideo');
landingVideo.src = product.video;
landingVideo.addEventListener('error', () => {
  console.warn('Video failed to load:', product.video);
  landingVideo.poster = product.detailImage || '';
});
const detailImage = document.getElementById('detailImage');
if (detailImage && product.detailImage) {
  detailImage.src = product.detailImage;
  detailImage.alt = `${product.brand} ${product.name} 상세페이지 이미지`;
  detailImage.addEventListener('error', () => {
    detailImage.src = 'assets/salon_detail_page.jpg';
    const caption = document.getElementById('detailCaption');
    if (caption) caption.textContent = '상세 이미지 파일을 찾지 못해 기본 상세 이미지로 표시합니다. assets/detail_pages 경로를 확인하세요.';
  });
}
document.title = `${product.name} / GRVN Affiliate Landing`;
const clipId = qs('clip') || product.defaultClip || 'stn-shortform';
const setText = (id, value) => { const el = document.getElementById(id); if(el) el.textContent = value; };
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
setText('specCommission', `${Math.round(product.commission * 100)}%`);
optionSelect.innerHTML = product.options.map(o=>`<option>${o}</option>`).join('');
// External mall links are intentionally not exposed on the customer landing page.
// The product detail image and checkout flow stay inside GRVN.
const detailCaption = document.getElementById('detailCaption');
if (detailCaption) detailCaption.textContent = `${product.defaultInfluencer || '인플루언서'} 영상 속 LOOK 상품입니다. ${product.name} 상세 이미지가 GRVN 내부에 직접 표시되며, 옵션 선택 후 이 페이지에서 바로 결제합니다.`;

function updateSummary(){
  const qty = Math.max(1, Number(qtyInput.value)||1);
  const subtotal = product.price * qty;
  const commission = Math.round(subtotal * product.commission);
  document.getElementById('subtotal').textContent = money(subtotal);
  document.getElementById('commission').textContent = money(commission);
  document.getElementById('total').textContent = money(subtotal);
}
qtyInput.addEventListener('input', updateSummary);
updateSummary();

document.getElementById('checkoutBtn').addEventListener('click', ()=>{
  const qty = Math.max(1, Number(qtyInput.value)||1);
  const amount = product.price * qty;
  const commission = Math.round(amount * product.commission);
  stnLog({
    type:'order',
    event:'checkout_test_completed',
    productId:product.id,
    productName:product.name,
    code,
    amount,
    qty,
    commission,
    option:optionSelect.value,
    campaign:product.campaign || qs('utm_campaign') || 'salondeseoul_cristine_tweed',
    utm_source:qs('utm_source') || 'instagram',
    utm_medium:qs('utm_medium') || 'affiliate',
    utm_content:qs('utm_content') || clipId
  });
  document.getElementById('completeText').textContent = `${code} 코드 기준으로 ${product.name} ${qty}개 주문, 매출 ${money(amount)}, 예상 수수료 ${money(commission)}가 기록되었습니다.`;
  document.getElementById('complete').classList.add('show');
  toast('결제 테스트가 완료되었습니다. 인플 대시보드에 반영됩니다.');
});
