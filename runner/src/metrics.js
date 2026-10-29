const fs=require('node:fs/promises'); const path=require('node:path');
const {inStockSizes}=require('./state'); const {discountOf}=require('./discount'); const {categoryFor}=require('./rules'); const report=require('./metrics-report');
// Metrics wrapper: observes runner inputs/outputs, never mutates them. All writes are best-effort; callers wrap invocations in try/catch so a metrics failure can never fail a run.
function sourceDir(dir,source){return path.join(dir,source);}
async function readLastSuccess(dir,source){
 try{const value=JSON.parse(await fs.readFile(path.join(sourceDir(dir,source),'last-success.json'),'utf8'));return value&&typeof value==='object'?value:{};}catch(e){return {};}
}
function transitionsFor(products,section,config,priorState,now,since){
 const events=[]; const items=(priorState&&priorState.items)||{};
 for(const product of products||[]){
  const id=String(product&&product.id||''); if(!id)continue;
  const old=items[`${section.id}:${id}`];
  if(!old||!Array.isArray(old.sizesInStock))continue;
  const sizesNow=inStockSizes(product);
  if(!sizesNow)continue;
  const added=sizesNow.filter(l=>!old.sizesInStock.includes(l));
  const removed=old.sizesInStock.filter(l=>!sizesNow.includes(l));
  if(!added.length&&!removed.length)continue;
  const {discount,sale,original}=discountOf(product);
  events.push({t:now,since:since||null,section:section.id,id,name:product.productName||'',category:categoryFor(product,section,config).label,sizesAdded:added,sizesRemoved:removed,inStockCount:sizesNow.length,price:sale,mrp:original,discount});
 }
 return events;
}
async function appendLines(file,rows){if(!rows.length)return;await fs.mkdir(path.dirname(file),{recursive:true});await fs.appendFile(file,rows.map(x=>JSON.stringify(x)).join('\n')+'\n');}
async function captureSection(dir,source,{products,section,config,priorState,now}){
 const last=await readLastSuccess(dir,source);
 const events=transitionsFor(products,section,config,priorState,now,last[section.id]);
 await appendLines(path.join(sourceDir(dir,source),'events.jsonl'),events);
 return {events:events.length,since:last[section.id]||null};
}
async function finishRun(dir,source,{startedAt,endedAt,status,sections,error}){
 const base=sourceDir(dir,source); await fs.mkdir(base,{recursive:true});
 const ended=endedAt||new Date().toISOString();
 const record={t:ended,startedAt,status,sections:sections||[],durationMs:Number.isFinite(Date.parse(startedAt))?Date.parse(ended)-Date.parse(startedAt):null,runId:process.env.GITHUB_RUN_ID||null,...(error?{error}:{})};
 await appendLines(path.join(base,'runs.jsonl'),[record]);
 const last=await readLastSuccess(dir,source);
 for(const s of sections||[])if(s&&s.status==='ok'&&s.scannedAt)last[s.id]=s.scannedAt;
 await fs.writeFile(path.join(base,'last-success.json'),JSON.stringify(last,null,2)+'\n');
 await report.writeReport(dir,source);
}
module.exports={transitionsFor,captureSection,finishRun,readLastSuccess};
