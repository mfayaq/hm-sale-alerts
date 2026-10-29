const fs=require('node:fs/promises'); const path=require('node:path');
// Regenerates METRICS.md from the jsonl logs. Counts are detections between two checks, never exact restock times.
async function readJsonl(file){
 try{const text=await fs.readFile(file,'utf8');return text.split('\n').filter(Boolean).map(line=>{try{return JSON.parse(line);}catch(e){return null;}}).filter(Boolean);}catch(e){return [];}
}
const IST_OFFSET_MS=330*60000;
function istParts(iso){const d=new Date(Date.parse(iso)+IST_OFFSET_MS);return {date:d.toISOString().slice(0,10),time:d.toISOString().slice(11,16),weekday:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()]};}
function istStamp(iso){const p=istParts(iso);return `${p.date} ${p.time}`;}
function windowKey(since,t){return since?`${istParts(since).time}-${istParts(t).time}`:'unknown window';}
function windowStart(key){return key==='unknown window'?'99:99':key.slice(0,5);}
const WEEKDAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
function money(v){return v==null?'-':`₹${v}`;}
async function writeReport(dir,source){
 const base=path.join(dir,source);
 const events=await readJsonl(path.join(base,'events.jsonl'));
 const runs=await readJsonl(path.join(base,'runs.jsonl'));
 const restocks=events.filter(e=>Array.isArray(e.sizesAdded)&&e.sizesAdded.length);
 const firstDate=events.length?istParts(events.map(e=>e.t).sort()[0]).date:null;
 const windows=new Map();
 const bump=(map,key,field)=>{const row=map.get(key)||{restocks:0,checks:0};row[field]+=1;map.set(key,row);};
 for(const e of restocks)bump(windows,windowKey(e.since,e.t),'restocks');
 const weekdays=new Map();
 for(const e of restocks)bump(weekdays,istParts(e.t).weekday,'restocks');
 for(const run of runs)for(const s of run.sections||[]){
  if(s&&s.status==='ok'&&s.scannedAt){bump(windows,windowKey(s.since,s.scannedAt),'checks');bump(weekdays,istParts(s.scannedAt).weekday,'checks');}
 }
 const bySection={},byCategory={};
 for(const e of restocks){bySection[e.section]=(bySection[e.section]||0)+1;byCategory[e.category]=(byCategory[e.category]||0)+1;}
 const recent=[...restocks].sort((a,b)=>b.t.localeCompare(a.t)).slice(0,20);
 const recentRuns=[...runs].sort((a,b)=>b.t.localeCompare(a.t)).slice(0,10);
 const L=[];
 L.push('# H&M Sale Alerts metrics','');
 L.push(`Auto-generated from the runner logs. Last updated ${istStamp(new Date().toISOString())} IST.${firstDate?` Data since ${firstDate}.`:''}`,'');
 L.push('Counts are detections between two checks, not exact restock times. A restock is counted when a check finds in-stock sizes that were out at the previous successful check. A restock that appears and sells out between two checks is invisible.','');
 L.push('## Restocks by detection window (IST)','');
 L.push('| Window | Restocks detected | Successful checks |','| --- | --- | --- |');
 for(const [key,row] of [...windows.entries()].sort((a,b)=>windowStart(a[0]).localeCompare(windowStart(b[0]))))L.push(`| ${key} | ${row.restocks} | ${row.checks} |`);
 L.push('','Windows follow the run schedule; a window with zero checks means missing coverage, not zero restocks.','');
 L.push('## Restocks by weekday (IST)','');
 L.push('| Weekday | Restocks detected | Successful checks |','| --- | --- | --- |');
 for(const day of WEEKDAYS){const row=weekdays.get(day);if(row)L.push(`| ${day} | ${row.restocks} | ${row.checks} |`);}
 L.push('','## Restocks by section','');
 L.push('| Section | Restocks detected |','| --- | --- |');
 for(const [k,v] of Object.entries(bySection).sort((a,b)=>b[1]-a[1]))L.push(`| ${k} | ${v} |`);
 L.push('','## Top categories','');
 L.push('| Category | Restocks detected |','| --- | --- |');
 for(const [k,v] of Object.entries(byCategory).sort((a,b)=>b[1]-a[1]).slice(0,10))L.push(`| ${k} | ${v} |`);
 L.push('','## Recent restock events','');
 if(!recent.length)L.push('None recorded yet.');
 for(const e of recent)L.push(`- ${istStamp(e.t)} IST - ${e.section} - ${e.name} - sizes back: ${e.sizesAdded.join(', ')} - ${money(e.price)} (${e.discount}% off) - window ${windowKey(e.since,e.t)}`);
 L.push('','## Scan health (recent runs)','');
 if(!recentRuns.length)L.push('No runs recorded yet.');
 for(const r of recentRuns){const ok=(r.sections||[]).filter(s=>s.status==='ok').length;const total=(r.sections||[]).length;const secs=r.durationMs==null?'-':`${Math.round(r.durationMs/1000)}s`;L.push(`- ${istStamp(r.t)} IST - ${r.status} - sections ok: ${ok}/${total} - ${secs}${r.error?` - ${r.error}`:''}`);}
 L.push('');
 await fs.mkdir(base,{recursive:true});
 await fs.writeFile(path.join(base,'METRICS.md'),L.join('\n'));
}
module.exports={writeReport,readJsonl,istParts,windowKey};
