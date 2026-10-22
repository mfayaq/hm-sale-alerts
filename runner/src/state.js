const {qualifies}=require("./rules"); const {discountOf}=require("./discount");
function freshState(){return {version:1,items:{}};}
function inStockSizes(product){return Array.isArray(product.sizes)?[...new Set(product.sizes.filter(x=>Number(x?.stock)>0&&x?.label).map(x=>String(x.label)))]:null;}
function chooseAlerts(products,section,config,state,now=new Date().toISOString(),{forceResend=false,restock=false}={}){
 const updates={},candidates=[];
 for(const product of products){const id=String(product.id||"");if(!id)continue;const key=`${section.id}:${id}`;const {discount,sale,original}=discountOf(product);const old=state.items[key];const sizesNow=inStockSizes(product);updates[key]={...old,name:product.productName||"",lastSeenDiscount:discount,lastSeenPrice:sale,lastSeenAt:now};if(sizesNow)updates[key].sizesInStock=sizesNow;if(qualifies(product,section,config)&&(forceResend||!old||old.lastAlertedDiscount==null||discount>old.lastAlertedDiscount))candidates.push({product,key,tag:forceResend?"RESEND":old?"UP":"NEW",previous:old?.lastAlertedDiscount,discount,sale,original,sizesNow});
  else if(restock&&old&&Array.isArray(old.sizesInStock)&&sizesNow&&qualifies(product,section,config)){const back=sizesNow.filter(l=>!old.sizesInStock.includes(l));if(back.length)candidates.push({product,key,tag:"RESTOCK",restockSizes:back,discount,sale,original,sizesNow});}}
 candidates.sort((a,b)=>b.discount-a.discount||a.key.localeCompare(b.key));
 const hasSectionHistory=Object.keys(state.items||{}).some(key=>key.startsWith(`${section.id}:`));
 const firstRun=forceResend||!hasSectionHistory;
 const configuredLimit=section.firstRunLimit??config.firstRunLimit??20;
 const limit=configuredLimit==="all"?Infinity:Math.max(0,Number(configuredLimit));
 const selected=firstRun?candidates.slice(0,limit):candidates;
 // Record baselines for all first-run matches, including deals beyond the cap, to avoid spilling them over later.
 if(firstRun)for(const c of candidates)if(!state.items[c.key]){const item=updates[c.key];item.lastAlertedDiscount=c.discount;item.lastAlertedPrice=c.sale;item.lastAlertedAt=now;}
 for(const [key,item] of Object.entries(updates))if(item.lastSeenAt&&Date.now()-Date.parse(item.lastSeenAt)>45*86400000)delete updates[key];
 return {alerts:selected,nextState:{version:1,items:{...state.items,...updates}}};
}
function stateBeforePendingAlerts(previous,next,alerts){
 const result={version:next.version||1,items:{...next.items}};
 for(const alert of alerts){
  const item={...(result.items[alert.key]||{})};
  const old=previous.items?.[alert.key];
  for(const field of ["lastAlertedDiscount","lastAlertedPrice","lastAlertedAt","sizesInStock"]){
   if(old&&Object.hasOwn(old,field))item[field]=old[field];else delete item[field];
  }
  result.items[alert.key]=item;
 }
 return result;
}
function recordAccepted(state,alert,now=new Date().toISOString()){const old=state.items[alert.key]||{};state.items[alert.key]={...old,...(alert.tag==="RESTOCK"?{}:{lastAlertedDiscount:alert.discount,lastAlertedPrice:alert.sale,lastAlertedAt:now}),...(alert.sizesNow?{sizesInStock:alert.sizesNow}:{})};}
module.exports={inStockSizes,freshState,chooseAlerts,stateBeforePendingAlerts,recordAccepted};

