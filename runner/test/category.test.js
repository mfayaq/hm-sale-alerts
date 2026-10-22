const test=require('node:test');const assert=require('node:assert/strict');
const {categoryFor,thresholdFor,qualifies}=require('../src/rules');
const {batchAlertGroups}=require('../src/notify');
const config=require('../config.json');
const section=config.sections.find(x=>x.id==='men');
const p=(code,name='Item')=>({mainCatCode:code,productName:name,prices:[{priceType:'whitePrice',price:1000},{priceType:'redPrice',price:300}]});
test('maps H&M listing API prefixes to visible menu labels',()=>{
  assert.equal(categoryFor(p('men_tshirtstanks_shortsleeve'),section,config).label,'T-SHIRTS & TOPS');
  assert.equal(categoryFor(p('men_jeans_loose'),section,config).label,'JEANS');
  assert.equal(categoryFor(p('men_tshirtstanks_poloshirts_shortsleeve'),section,config).label,'POLOS');
});
test('category threshold is configurable and most-specific configured prefix wins',()=>{
  section.categories.men_jeans.minDiscount=70;
  section.categories.men_jeans_loose={label:'JEANS',minDiscount:80};
  assert.equal(thresholdFor(p('men_jeans_loose'),section,config).minDiscount,80);
  assert.equal(qualifies(p('men_jeans_loose'),section,config),false);
  delete section.categories.men_jeans_loose;section.categories.men_jeans.minDiscount=60;
});
test('alerts are separately grouped per category and use Instamart header/item format',()=>{
  const alerts=[{product:{productName:'Tee',url:'/p1'},original:1000,sale:300,discount:70,category:{key:'tees',label:'T-SHIRTS & TOPS'}},{product:{productName:'Jeans',url:'/p2'},original:1000,sale:300,discount:70,category:{key:'jeans',label:'JEANS'}}];
  const batches=batchAlertGroups(alerts,section);
  assert.equal(batches.length,2);assert.match(batches[0].text,/<b>\[H&amp;M Men • T-SHIRTS &amp; TOPS • 1 Found\]<\/b>/);assert.match(batches[0].text,/1\. <b>Tee<\/b>\nMRP: ₹1000 \| Price: ₹300 \| <b>70% OFF<\/b>/);assert.match(batches[1].text,/<b>\[H&amp;M Men • JEANS • 1 Found\]<\/b>/);
});
test('long category alerts chunk under the safe message cap without losing products',()=>{
  const alerts=Array.from({length:20},(_,i)=>({product:{productName:`Item ${i} ${'x'.repeat(300)}`,url:`/p${i}`},original:1000,sale:300,discount:70,category:{key:'tees',label:'T-SHIRTS & TOPS'}}));
  const batches=batchAlertGroups(alerts,section,1200);assert.ok(batches.length>1);assert.ok(batches.every(b=>b.text.length<=1200));assert.equal(batches.reduce((n,b)=>n+b.alerts.length,0),20);
});
