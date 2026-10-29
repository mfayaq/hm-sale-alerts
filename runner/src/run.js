const fs=require('node:fs/promises'); const path=require('node:path');
const config=require('../config.json'); const {fetchAll}=require('./listing'); const {freshState,chooseAlerts,stateBeforePendingAlerts,recordAccepted}=require('./state'); const {categoryFor}=require('./rules'); const {batchAlertGroups,send}=require('./notify'); const metrics=require('./metrics');
const metricsDir=process.env.METRICS_DIR||path.join(process.cwd(),'.metrics');
const metricsSource=process.env.METRICS_SOURCE||'hm-sale-alerts';
const runContext={startedAt:new Date().toISOString(),sections:[]};
const metricsWarn=(where,e)=>console.warn(`metrics_warn ${where} reason=${String(e&&e.message).replace(/[\r\n]/g,' ').slice(0,200)}`);
async function main(){
 const dry=process.argv.includes('--dry-run');
 const forceResend=process.argv.includes('--force-resend');
 const firstRunLimitOverride=process.env.FIRST_RUN_LIMIT?.trim();
 const sectionOverride=process.env.SECTIONS?.trim();
 const activeSections=sectionOverride?sectionOverride.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean):null;
 const runConfig=JSON.parse(JSON.stringify(config));
 if(firstRunLimitOverride){const value=firstRunLimitOverride.toLowerCase()==='all'?'all':Number(firstRunLimitOverride);if(value!=='all'&&(!Number.isInteger(value)||value<0))throw new Error('FIRST_RUN_LIMIT must be a non-negative integer or all');for(const section of runConfig.sections)section.firstRunLimit=value;}
 if(activeSections){const aliases={women:'ladies',lady:'ladies'};for(const name of activeSections)if(!runConfig.sections.some(section=>section.id===(aliases[name]||name)))throw new Error(`Unknown section: ${name}`);}
 const sections=runConfig.sections.filter(section=>section.enabled&&(!activeSections||activeSections.includes(section.id)||activeSections.includes(section.id==='ladies'?'women':section.id))); 
 const restock=(process.env.RESTOCK_ALERTS?.trim()||String(config.restockAlerts??false)).toLowerCase()==='true';
 const statePath=process.env.STATE_FILE||path.join(process.cwd(),'data','seen.json');
 let state=freshState(); try{state=JSON.parse(await fs.readFile(statePath,'utf8'));}catch(e){if(e.code!=='ENOENT') throw e;}
 let total=0;
 for(const section of sections){
   const {products,totalPages}=await fetchAll(section,runConfig); total+=products.length;
   const now=new Date().toISOString();
   const result=chooseAlerts(products,section,runConfig,state,now,{forceResend,restock}); for(const alert of result.alerts) alert.category=categoryFor(alert.product,section,runConfig); console.log(`section=${section.id} pages=${totalPages} products=${products.length} matches=${result.alerts.length} force_resend=${forceResend}`);
   if(!dry){try{
     const cap=await metrics.captureSection(metricsDir,metricsSource,{products,section,config:runConfig,priorState:state,now});
     runContext.sections.push({id:section.id,pages:totalPages,scanned:products.length,alerts:result.alerts.reduce((a,x)=>(a[x.tag]=(a[x.tag]||0)+1,a),{}),status:'ok',scannedAt:now,since:cap.since,events:cap.events});
   }catch(e){metricsWarn(`section=${section.id}`,e);}}
   if(dry){console.log(`dry_run=true alerts=${result.alerts.slice(0,20).map(a=>`${a.key}:${a.tag}:${a.discount}`).join(',')}`); state=result.nextState;continue;}
   const stagedState=stateBeforePendingAlerts(state,result.nextState,result.alerts);
   const batches=batchAlertGroups(result.alerts,section);
   const counts=Object.entries(result.alerts.reduce((a,x)=>(a[x.category.label]=(a[x.category.label]||0)+1,a),{})).map(([k,v])=>`${k}:${v}`).join(',');
   console.log(`telegram_batches=${batches.length} products_in_batches=${result.alerts.length} categories=${counts}`);
   for(let i=0;i<batches.length;i++){
     await send(batches[i].text,process.env.TELEGRAM_BOT_TOKEN,process.env.TELEGRAM_CHAT_ID);
     for(const alert of batches[i].alerts) recordAccepted(stagedState,alert);
     state=stagedState;
     const tempPath=`${statePath}.tmp`;
     await fs.mkdir(path.dirname(statePath),{recursive:true});
     await fs.writeFile(tempPath,JSON.stringify(state,null,2)+'\n');
     await fs.rename(tempPath,statePath);
     if(i<batches.length-1) await new Promise(resolve=>setTimeout(resolve,1000));
   }
   if(!batches.length) state=result.nextState;
 }
 if(!dry){await fs.mkdir(path.dirname(statePath),{recursive:true});await fs.writeFile(statePath,JSON.stringify(state,null,2)+'\n');}
 if(!dry){try{await metrics.finishRun(metricsDir,metricsSource,{startedAt:runContext.startedAt,endedAt:new Date().toISOString(),status:'ok',sections:runContext.sections});}catch(e){metricsWarn('finish',e);}}
 console.log(`result=ok total_products=${total} dry_run=${dry} force_resend=${forceResend}`);
}
main().catch(async e=>{const reason=String(e.message).replace(/[\r\n]/g,' ').slice(0,300);console.error(`result=failed reason=${reason}`);if(!process.argv.includes('--dry-run')){try{await metrics.finishRun(metricsDir,metricsSource,{startedAt:runContext.startedAt,endedAt:new Date().toISOString(),status:'failed',sections:runContext.sections,error:reason});}catch(_){}}process.exitCode=1;});
