const product = getProduct(qs('product'));
const code = getActiveCode();
const qtyInput = document.getElementById('qtyInput');
const optionSelect = document.getElementById('optionSelect');

document.getElementById('productTitle').textContent = product.name;
document.getElementById('productDesc').textContent = `${product.brand} · ${product.desc}`;
document.getElementById('priceText').textContent = money(product.price);
document.getElementById('affCode').textContent = code;
document.getElementById('landingVideo').src = product.video;
const clipId = qs('clip') || 'stn-shortform';
const setText = (id, value) => { const el = document.getElementById(id); if(el) el.textContent = value; };
setText('detailCat1', product.category);
setText('detailBrand', product.brand);
setText('specBrand', product.brand);
setText('specCategory', product.category);
setText('specProductId', product.id);
setText('specClipId', clipId);
setText('specCommission', `${Math.round(product.commission * 100)}%`);
optionSelect.innerHTML = product.options.map(o=>`<option>${o}</option>`).join('');

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
  stnLog({type:'order',event:'checkout_test_completed',productId:product.id,productName:product.name,code,amount,qty,commission,option:optionSelect.value});
  document.getElementById('completeText').textContent = `${code} 코드 기준으로 ${product.name} ${qty}개 주문, 매출 ${money(amount)}, 예상 수수료 ${money(commission)}가 기록되었습니다.`;
  document.getElementById('complete').classList.add('show');
  toast('결제 테스트가 완료되었습니다. 인플 대시보드에 반영됩니다.');
});
