const {discountOf}=require('./discount');

const PREFIX_LABELS = {
  men: [
    ['men_tshirtstanks_poloshirts', 'POLOS'],
    ['men_tshirtstanks_printed', 'MERCH & GRAPHICS'],
    ['men_tshirtstanks', 'T-SHIRTS & TOPS'], ['men_shirts', 'SHIRTS'], ['men_jeans', 'JEANS'],
    ['men_trousers', 'TROUSERS'], ['men_hoodiessweatshirts', 'HOODIES & SWEATSHIRTS'],
    ['men_jacketscoats', 'JACKETS'], ['men_sweatpants', 'SWEATPANTS'], ['men_blazerssuits', 'BLAZERS & SUITS'],
    ['men_basics', 'BASICS'], ['men_linen', 'LINEN CLOTHING'], ['men_underwear', 'UNDERWEAR'],
    ['men_cardigansjumpers', 'SWEATERS & CARDIGANS'], ['men_socks', 'SOCKS 3 FOR 2'],
    ['sportswear_men_functional', 'FUNCTIONAL ESSENTIALS'], ['sportswear_men', 'SPORT'],
    ['men_nightwearloungewear', 'SLEEPWEAR & LOUNGEWEAR'], ['men_premium_selection', 'PREMIUM SELECTION'],
    ['men_shorts', 'SHORTS'], ['men_swimwear', 'SWIMWEAR'], ['men_accessories', 'ACCESSORIES'], ['men_shoes', 'SHOES']
  ],
  ladies: [
    ['ladies_tops', 'TOPS'], ['ladies_shirtblouses', 'SHIRTS & BLOUSES'], ['ladies_shirtsblouses', 'SHIRTS & BLOUSES'],
    ['ladies_dresses', 'DRESSES'], ['ladies_jeans', 'JEANS'], ['ladies_trousers', 'TROUSERS'],
    ['ladies_shorts', 'SHORTS'], ['ladies_skirts', 'SKIRTS'], ['ladies_jacketscoats', 'JACKETS & COATS'],
    ['ladies_blazerswaistcoats', 'BLAZERS & WAISTCOATS'], ['ladies_cardigansjumpers', 'CARDIGANS & JUMPERS'],
    ['ladies_lingerie', 'LINGERIE'], ['ladies_basics', 'BASICS'], ['ladies_nightwear', 'NIGHTWEAR'],
    ['ladies_occasion', 'OCCASIONWEAR'], ['ladies_premium_selection', 'PREMIUM SELECTION'],
    ['ladies_swimwear', 'SWIMWEAR'], ['ladies_jumpsuits', 'JUMPSUITS'], ['ladies_maternity', 'MATERNITY'],
    ['ladies_accessories', 'ACCESSORIES'], ['ladies_shoes', 'SHOES'], ['sportswear_women', 'SPORT'],
    ['home_', 'HOME']
  ],
  kids: [
    ['kids_olderkids_clothing_tops_tshirts', 'T-SHIRTS & TOPS'], ['kids_olderkids_clothing_tops', 'TOPS'],
    ['kids_olderkids_clothing_trousers', 'TROUSERS'], ['kids_clothing_jeans', 'JEANS'],
    ['kids_oldergirls_clothing_jeans', 'JEANS'], ['kids_olderboys_clothing_jeans', 'JEANS'],
    ['kids_boys_clothing_trousers', 'TROUSERS'], ['kids_girls_clothing_trousers', 'TROUSERS'],
    ['kids_baby_boy_clothing_trousersjeans', 'TROUSERS & JEANS'], ['kids_baby_girl_clothing_trousersjeans', 'TROUSERS & JEANS'],
    ['kids_girls_clothing_topstshirts', 'T-SHIRTS & TOPS'], ['kids_boys_clothing_tshirtsshirts_tshirts', 'T-SHIRTS'],
    ['kids_boys_clothing_tshirtsshirts_shirts', 'SHIRTS'], ['kids_baby_boy_clothing_tshirtsshirts_tshirts', 'T-SHIRTS'],
    ['kids_baby_boy_clothing_tshirtsshirts_shirts', 'SHIRTS'], ['kids_baby_girl_clothing_tops', 'TOPS'],
    ['kids_girls_clothing_dresses', 'DRESSES'], ['kids_oldergirls_clothing_dresses', 'DRESSES'],
    ['kids_boys_clothing_jumperssweatshirts', 'HOODIES & SWEATSHIRTS'], ['kids_girls_clothing_jumperssweatshirts', 'CARDIGANS & JUMPERS'],
    ['kids_olderboys_clothing_blazerssuits', 'BLAZERS & SUITS'], ['kids_boys_clothing_blazerssuits', 'BLAZERS & SUITS'],
    ['kids_girls_clothing_shorts', 'SHORTS'], ['kids_boys_clothing_shorts', 'SHORTS'], ['kids_oldergirls_clothing_shorts', 'SHORTS'],
    ['kids_olderboys_clothing_shorts', 'SHORTS'], ['kids_girls_clothing_skirts', 'SKIRTS'], ['kids_oldergirls_clothing_skirts', 'SKIRTS'],
    ['kids_girls_clothing_swimwear', 'SWIMWEAR'], ['kids_boys_clothing_swimwear', 'SWIMWEAR'],
    ['kids_oldergirls_clothing_swimwear', 'SWIMWEAR'], ['kids_olderboys_clothing_swimwear', 'SWIMWEAR'],
    ['kids_girls_clothing_sockstights', 'SOCKS & TIGHTS'], ['kids_baby_girl_clothing_sockstights', 'SOCKS & TIGHTS'],
    ['kids_boys_clothing_nightwear', 'NIGHTWEAR'], ['kids_girls_clothing_nightwear', 'NIGHTWEAR'],
    ['kids_oldergirls_clothing_nightwear', 'NIGHTWEAR'], ['kids_olderboys_clothing_nightwear', 'NIGHTWEAR'],
    ['kids_baby_boy_clothing_nightwear', 'NIGHTWEAR'], ['kids_new_born_clothing_nightwear', 'NIGHTWEAR'],
    ['kids_girls_accessories', 'ACCESSORIES'], ['kids_boys_accessories', 'ACCESSORIES'], ['kids_oldergirls_accessories', 'ACCESSORIES'],
    ['kids_olderboys_accessories', 'ACCESSORIES'], ['kids_adorables', 'ADORABLES'], ['kids_new_born', 'NEWBORN'],
    ['kids_baby', 'BABY'], ['kids_schooluniform', 'SCHOOL UNIFORM'], ['kids_olderkids_clothing', 'CLOTHING']
  ]
};
function categoryFor(product, section, config) {
  const code=String(product.mainCatCode||'').toLowerCase();
  const sectionKey=section.id==='ladies'?'ladies':section.id;
  const configured=Object.entries(section.categories||config.categories?.[sectionKey]||{}).map(([prefix,value])=>[prefix.toLowerCase(),value]);
  const mapped=(PREFIX_LABELS[sectionKey]||[]).map(([prefix,label])=>[prefix.toLowerCase(),{label}]);
  const match=[...configured,...mapped].filter(([prefix])=>code===prefix||code.startsWith(`${prefix}_`)).sort((a,b)=>b[0].length-a[0].length)[0];
  if(match) return {key:match[0],label:match[1].label||humanize(match[0]),minDiscount:match[1].minDiscount,order:Object.keys(section.categories||{}).indexOf(match[0])};
  const label=humanize(code);
  return {key:code||'uncategorized',label,minDiscount:section.defaultCategoryMinDiscount??config.categoryDefaults?.minDiscount,order:Number.MAX_SAFE_INTEGER};
}
function humanize(code){return String(code||'Uncategorized').replace(/^(men|ladies|kids)_/i,'').replace(/^(kids_)?(boys|girls|olderboys|oldergirls|olderkids|baby|new_born)_/i,'').split('_').filter(Boolean).map(x=>x[0]?.toUpperCase()+x.slice(1)).join(' ')||'Uncategorized';}
function matchRule(product, rule) {
  const cat=String(product.mainCatCode||'').toLowerCase();
  const text=`${product.productName||''} ${cat}`.toLowerCase();
  return (!rule.categoryContains||cat.includes(rule.categoryContains.toLowerCase()))&&(rule.keywords||[]).every(k=>text.includes(k.toLowerCase()));
}
function thresholdFor(product,section,config){
  const category=categoryFor(product,section,config);
  let minDiscount=category.minDiscount??section.minDiscount??config.defaults.minDiscount;
  let maxPrice=section.maxPrice??config.defaults.maxPrice??null;
  const sub=section.subcategories||{};
  const matches=Object.entries(sub).filter(([key])=>String(product.mainCatCode||'').toLowerCase()===key.toLowerCase()||String(product.mainCatCode||'').toLowerCase().startsWith(`${key.toLowerCase()}_`)).sort((a,b)=>b[0].length-a[0].length);
  if(matches.length){const rule=matches[0][1];minDiscount=rule.minDiscount??minDiscount;maxPrice=rule.maxPrice??maxPrice;}
  const rules=(config.rules||[]).filter(r=>r.section===section.id&&matchRule(product,r));
  if(rules.length){const mins=rules.map(r=>r.minDiscount).filter(Number.isFinite);if(mins.length)minDiscount=Math.max(minDiscount,...mins);const caps=rules.map(r=>r.maxPrice).filter(Number.isFinite);if(caps.length)maxPrice=maxPrice==null?Math.min(...caps):Math.min(maxPrice,...caps);}
  return {minDiscount,maxPrice,category};
}
function qualifies(product,section,config){const price=discountOf(product),threshold=thresholdFor(product,section,config);return price.alertable&&Number.isFinite(threshold.minDiscount)&&price.discount>=threshold.minDiscount&&(threshold.maxPrice==null||price.sale<=threshold.maxPrice);}
module.exports={PREFIX_LABELS,matchRule,categoryFor,thresholdFor,qualifies};
