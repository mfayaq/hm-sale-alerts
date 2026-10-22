const test=require('node:test');const assert=require('node:assert');
const {chooseAlerts,stateBeforePendingAlerts,recordAccepted}=require('../src/state');
const {batchAlertGroups}=require('../src/notify');
const config=require('../config.json');
const section=config.sections.find(s=>s.id==='men');
const mk=(id,sizes,red=300,white=1000)=>({id,productName:'Item '+id,url:'/p/'+id,prices:[{priceType:'redPrice',price:red},{priceType:'whitePrice',price:white}],percentageDiscount:Math.round((1-red/white)*100),sizes:sizes.map(([label,stock])=>({label,stock})),mainCatCode:'men_tshirtstanks_polos'});
const base=()=>({version:1,items:{'men:1':{lastAlertedDiscount:70,lastAlertedPrice:300,lastAlertedAt:'x',sizesInStock:['S']}}});
const run=(p,st,restock=true)=>chooseAlerts(p,section,config,st,'2026-10-04T00:00:00Z',{restock});
test('baseline: no sizesInStock in state -> silent, sizes recorded',()=>{
  const st={version:1,items:{'men:1':{lastAlertedDiscount:70}}};
  const r=run([mk('1',[['S',2],['M',2]])],st);
  assert.equal(r.alerts.length,0);assert.deepEqual(r.nextState.items['men:1'].sizesInStock,['S','M']);});
test('restock alert when a size returns; tag and sizes',()=>{
  const r=run([mk('1',[['S',2],['M',2]])],base());
  assert.equal(r.alerts.length,1);assert.equal(r.alerts[0].tag,'RESTOCK');assert.deepEqual(r.alerts[0].restockSizes,['M']);
  const t=batchAlertGroups(r.alerts.map(a=>({...a,category:{key:'k',label:'POLOS'}})),section)[0].text;
  assert.match(t,/Back in stock:<\/b> M/);assert.match(t,/POLOS/);});
test('off switch: no restock alert, sizes still tracked',()=>{
  const r=run([mk('1',[['S',2],['M',2]])],base(),false);
  assert.equal(r.alerts.length,0);assert.deepEqual(r.nextState.items['men:1'].sizesInStock,['S','M']);});
test('one alert per item: higher discount gives normal alert only, no restock',()=>{
  const r=run([mk('1',[['S',2],['M',2]],200)],base());
  assert.equal(r.alerts.length,1);assert.equal(r.alerts[0].tag,'UP');});
test('no repeat until sold out and back',()=>{
  let st=base();let r=run([mk('1',[['S',2],['M',2]])],st);
  st={version:1,items:{...st.items}};
  const staged=stateBeforePendingAlerts(st,r.nextState,r.alerts);recordAccepted(staged,r.alerts[0]);
  assert.equal(staged.items['men:1'].lastAlertedDiscount,70);
  assert.equal(run([mk('1',[['S',2],['M',2]])],staged).alerts.length,0);
  const out=run([mk('1',[['S',0],['M',0]])],staged);assert.equal(out.alerts.length,0);
  assert.equal(run([mk('1',[['S',2]])],out.nextState).alerts.length,1);});
test('failed send keeps old sizes so restock retries',()=>{
  const st=base();const r=run([mk('1',[['S',2],['M',2]])],st);
  const staged=stateBeforePendingAlerts(st,r.nextState,r.alerts);
  assert.deepEqual(staged.items['men:1'].sizesInStock,['S']);assert.equal(run([mk('1',[['S',2],['M',2]])],staged).alerts.length,1);});
test('below threshold: no restock alert',()=>{
  assert.equal(run([mk('1',[['S',2],['M',2]],800)],base()).alerts.length,0);});
