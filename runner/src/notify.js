function esc(s='') {return String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
function sizesLine(p) {
  if (!Array.isArray(p.sizes) || !p.sizes.length) return '';
  const labels = p.sizes.filter(x => Number(x?.stock) > 0 && x?.label).map(x => esc(x.label));
  return `\nSizes: ${labels.length ? labels.join(', ') : 'none in stock'}`;
}
function message(alert, category, index=null) {
  const p=alert.product;
  const url=p.url?.startsWith('http')?p.url:`https://www2.hm.com${p.url||''}`;
  const prefix=index==null?'• ':`${index}. `;
  return `${prefix}<b>${esc(p.productName||'')}</b>\nMRP: ₹${alert.original} | Price: ₹${alert.sale} | <b>${alert.discount}% OFF</b>${alert.tag==='RESTOCK'?`\n🔄 <b>Back in stock:</b> ${alert.restockSizes.map(esc).join(', ')}`:sizesLine(p)}\n<a href="${esc(url)}">Click here</a>`;
}
async function send(text, token, chatId, fetchImpl=fetch) {
  if (!token || !chatId) throw new Error('Missing Telegram configuration');
  const response=await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text,parse_mode:'HTML',disable_web_page_preview:true})});
  const body=await response.json(); if (!response.ok || !body.ok) throw new Error(`Telegram send failed (HTTP ${response.status})`);
  return body.result.message_id;
}
function batchAlertGroups(alerts, section, limit=3800) {
  const buckets=new Map();
  for(const alert of alerts||[]){const cat=alert.category||{key:'uncategorized',label:'Uncategorized'};if(!buckets.has(cat.key))buckets.set(cat.key,{category:cat,alerts:[]});buckets.get(cat.key).alerts.push(alert);}
  const groups=[];
  for(const {category,alerts:items} of [...buckets.values()].sort((a,b)=>(a.category.order??Number.MAX_SAFE_INTEGER)-(b.category.order??Number.MAX_SAFE_INTEGER))){
    const header=(part,total)=>`<b>[H&amp;M ${esc(section.label||section.id)} • ${esc(category.label)} • ${items.length} Found${total>1?` (${part}/${total})`:''}]</b>\n\n`;
    const chunks=[];let chunk=[],length=0;
    for(const alert of items){const item=message(alert,category,chunk.length+1)+'\n\n';if(chunk.length&&length+item.length>limit){chunks.push(chunk);chunk=[];length=0;}if(item.length>limit-100)throw new Error('H&M alert item exceeds Telegram batch limit');chunk.push(alert);length+=item.length;}
    if(chunk.length)chunks.push(chunk);
    chunks.forEach((chunkAlerts,i)=>{const text=header(i+1,chunks.length)+chunkAlerts.map((a,n)=>message(a,category,n+1)).join('\n\n');if(text.length>limit)throw new Error(`H&M batch for ${category.label} exceeds safe Telegram limit`);groups.push({text,alerts:chunkAlerts,category});});
  }
  return groups;
}
function batchMessages(alerts,section,limit=3800){return batchAlertGroups(alerts,section,limit).map(group=>group.text);}
module.exports={esc,sizesLine,message,batchMessages,batchAlertGroups,send};

