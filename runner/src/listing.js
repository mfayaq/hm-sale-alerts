const API = 'https://api.hm.com/search-services/v1/en_in/listing/resultpage';
const ORIGIN = 'https://www2.hm.com';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function buildUrl(section, page, pageSize = 72) {
  const url = new URL(API);
  for (const [key, value] of Object.entries({pageSource:'PLP', pageId:section.pageId, categoryId:section.categoryId, touchPoint:'desktop', 'page-size':String(pageSize), page:String(page), sort:'DISCOUNT', filters:'sale:true', skipStockCheck:'false'})) url.searchParams.set(key, value);
  return url;
}
function normalize(payload) {
  const products = payload?.plpList?.productList ?? payload?.products;
  if (!Array.isArray(products) || !payload.pagination) throw new Error('Unexpected H&M listing response schema');
  return {products, pagination:payload.pagination};
}
async function fetchPage(section, page, pageSize = 72, fetchImpl = fetch) {
  const response = await fetchImpl(buildUrl(section, page, pageSize), {headers:{'User-Agent':'Mozilla/5.0 (compatible; HmSaleDeals/1.0)','Origin':ORIGIN,'Referer':section.listingUrl,'Accept':'application/json'}});
  if (!response.ok) {
    const body = (await response.text()).slice(0, 300);
    throw new Error(`H&M listing HTTP ${response.status}: ${body}`);
  }
  return normalize(await response.json());
}
async function fetchAll(section, config, fetchImpl = fetch) {
  let page = 1, totalPages = null;
  const products = [];
  while (page <= (config.maxPages || 40)) {
    if (page > 1 && config.delayMs) await sleep(config.delayMs);
    const result = await fetchPage(section, page, config.pageSize, fetchImpl);
    if (page === 1) totalPages = Number(result.pagination.totalPages);
    if (!Number.isInteger(totalPages) || totalPages < 1) throw new Error('Invalid H&M totalPages');
    products.push(...result.products);
    if (page >= totalPages) return {products, totalPages};
    page += 1;
  }
  throw new Error(`H&M page limit reached (${config.maxPages}) before listing completed`);
}
module.exports = {API, buildUrl, normalize, fetchPage, fetchAll};
