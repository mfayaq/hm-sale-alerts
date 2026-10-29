const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
const {transitionsFor,captureSection,finishRun,readLastSuccess}=require('../src/metrics');
const {writeReport,readJsonl}=require('../src/metrics-report');
const {chooseAlerts}=require('../src/state');
const config=require('../config.json');
const section=config.sections.find(s=>s.id==='men');
const mk=(id,sizes,red=300,white=1000)=>({id,productName:'Item '+id,mainCatCode:'men_tshirtstanks_polos',prices:[{priceType:'redPrice',price:red},{priceType:'whitePrice',price:white}],sizes:sizes.map(([label,stock])=>({label,stock}))});
const snap=x=>JSON.parse(JSON.stringify(x));
const NOW='2026-10-29T10:00:00.000Z';

test('transition recorded even when below alert threshold (unlike RESTOCK alerts)',()=>{
  const st={version:1,items:{'men:1':{sizesInStock:['S'],lastAlertedDiscount:70}}};
  const ev=transitionsFor([mk('1',[['S',2],['M',2]],800)],section,config,st,NOW,'2026-10-29T06:00:00.000Z');
  assert.equal(ev.length,1);assert.deepEqual(ev[0].sizesAdded,['M']);assert.equal(ev[0].discount,20);assert.equal(ev[0].since,'2026-10-29T06:00:00.000Z');
  assert.equal(chooseAlerts([mk('1',[['S',2],['M',2]],800)],section,config,st,NOW,{restock:true}).alerts.length,0);
});
test('added and removed both recorded; unchanged and unseen products skipped',()=>{
  const st={version:1,items:{'men:1':{sizesInStock:['S','M']},'men:2':{sizesInStock:['L']}}};
  const ev=transitionsFor([mk('1',[['S',0],['M',2],['XL',3]]),mk('2',[['L',2]]),mk('3',[['S',1]])],section,config,st,NOW,null);
  assert.equal(ev.length,1);assert.deepEqual(ev[0].sizesAdded,['XL']);assert.deepEqual(ev[0].sizesRemoved,['S']);
});
test('empty sizes array means stock-out recorded; missing sizes array skips',()=>{
  const st={version:1,items:{'men:1':{sizesInStock:['S']}}};
  const out=transitionsFor([mk('1',[])],section,config,st,NOW,null);
  assert.equal(out.length,1);assert.deepEqual(out[0].sizesRemoved,['S']);assert.deepEqual(out[0].sizesAdded,[]);
  const p=mk('1',[['S',2]]);delete p.sizes;
  assert.equal(transitionsFor([p],section,config,st,NOW,null).length,0);
});
test('wrapper mutates neither products nor prior state, chooseAlerts output unchanged by its presence',()=>{
  const st={version:1,items:{'men:1':{sizesInStock:['S'],lastAlertedDiscount:70,lastAlertedPrice:300,lastAlertedAt:'x'}}};
  const products=[mk('1',[['S',2],['M',2]])];
  const baseline=chooseAlerts(snap(products),section,config,snap(st),NOW,{restock:true});
  const alerts=chooseAlerts(products,section,config,st,NOW,{restock:true});
  const ev=transitionsFor(products,section,config,st,NOW,null);
  assert.deepEqual(alerts.alerts,baseline.alerts);assert.deepEqual(alerts.nextState,baseline.nextState);
  assert.deepEqual(st,{version:1,items:{'men:1':{sizesInStock:['S'],lastAlertedDiscount:70,lastAlertedPrice:300,lastAlertedAt:'x'}}});
  assert.deepEqual(products,[mk('1',[['S',2],['M',2]])]);
  assert.equal(ev.length,1);
});
test('captureSection and finishRun write logs; last-success updated only for ok sections',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'metrics-'));
  const st={version:1,items:{'men:1':{sizesInStock:['S']}}};
  const cap=await captureSection(dir,'hm-sale-alerts',{products:[mk('1',[['S',2],['M',2]])],section,config,priorState:st,now:NOW});
  assert.equal(cap.events,1);assert.equal(cap.since,null);
  await finishRun(dir,'hm-sale-alerts',{startedAt:'2026-10-29T09:58:00.000Z',endedAt:NOW,status:'ok',sections:[{id:'men',status:'ok',scannedAt:NOW,since:cap.since,events:1,pages:8,scanned:532,alerts:{RESTOCK:1}},{id:'ladies',status:'error'}]});
  const last=await readLastSuccess(dir,'hm-sale-alerts');
  assert.equal(last.men,NOW);assert.equal(last.ladies,undefined);
  assert.equal((await readJsonl(path.join(dir,'hm-sale-alerts','events.jsonl'))).length,1);
  const runs=await readJsonl(path.join(dir,'hm-sale-alerts','runs.jsonl'));
  assert.equal(runs.length,1);assert.equal(runs[0].status,'ok');assert.equal(runs[0].durationMs,120000);
  const cap2=await captureSection(dir,'hm-sale-alerts',{products:[mk('1',[['S',2],['M',2],['L',4]])],section,config,priorState:{version:1,items:{'men:1':{sizesInStock:['S','M']}}},now:'2026-10-29T14:00:00.000Z'});
  assert.equal(cap2.since,NOW);assert.equal(cap2.events,1);
  const md=await fs.readFile(path.join(dir,'hm-sale-alerts','METRICS.md'),'utf8');
  assert.match(md,/Restocks by detection window/);assert.match(md,/not exact restock times/);assert.match(md,/Item 1/);
});
test('report aggregates windows with coverage counts (IST conversion)',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'metrics-'));
  const base=path.join(dir,'hm-sale-alerts');await fs.mkdir(base,{recursive:true});
  const ev1={t:'2026-10-28T22:30:00.000Z',since:'2026-10-28T18:30:00.000Z',section:'men',id:'1',name:'Item 1',category:'POLOS',sizesAdded:['M'],sizesRemoved:[],inStockCount:2,price:300,mrp:1000,discount:70};
  await fs.writeFile(path.join(base,'events.jsonl'),JSON.stringify(ev1)+'\n');
  const run1={t:'2026-10-28T22:31:00.000Z',startedAt:'2026-10-28T22:29:00.000Z',status:'ok',sections:[{id:'men',status:'ok',scannedAt:'2026-10-28T22:30:00.000Z',since:'2026-10-28T18:30:00.000Z'}],durationMs:120000,runId:'1'};
  await fs.writeFile(path.join(base,'runs.jsonl'),JSON.stringify(run1)+'\n');
  await writeReport(dir,'hm-sale-alerts');
  const md=await fs.readFile(path.join(base,'METRICS.md'),'utf8');
  assert.match(md,/\| 00:00-04:00 \| 1 \| 1 \|/);
  assert.match(md,/Item 1/);assert.match(md,/POLOS/);
});
