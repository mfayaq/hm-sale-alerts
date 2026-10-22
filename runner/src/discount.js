function priceOf(product, priceType) {
  const price = (product.prices || []).find(p => p.priceType === priceType);
  const value = price && Number(price.price ?? price.value);
  return Number.isFinite(value) ? value : null;
}
function discountOf(product) {
  const original = priceOf(product, 'whitePrice');
  const sale = priceOf(product, 'redPrice');
  if (original == null || sale == null || original <= 0 || sale >= original) return {original, sale, discount:0, alertable:false};
  return {original, sale, discount:Math.round((original-sale)/original*100), alertable:true};
}
module.exports = {priceOf, discountOf};
