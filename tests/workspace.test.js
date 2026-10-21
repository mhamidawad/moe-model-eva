import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace,makeProvider,makeModel,endpointUrl,normalizeCatalog,planCatalog,fetchCatalog,prepareReports,mergeReports,saveWorkspace,loadWorkspace,reportTemplate,WORKSPACE_KEY} from '../out/workspace.js';
import {setWorkspace,models,runs,suites,aggregate,filteredModels,comparisonData} from '../out/data.js';

const provider=()=>makeProvider({name:'My OmniRoute',type:'omniroute',baseUrl:'https://gateway.example/v1'});
const workspace=()=>({...emptyWorkspace(),providers:[provider()]});
const report=(overrides={})=>({id:'live-run-001',source:'real',isSample:false,createdAt:'2026-10-21T10:00:00Z',model:{name:'Local Qwen',routingId:'mypc/qwen',provider:'My OmniRoute'},suite:{id:'my-coding',name:'My coding suite',version:'1.0'},latencySeconds:1.25,provenance:'Live inference executed by a test runner.',configuration:{temperature:0,maxOutputTokens:2048,timeoutMs:5000},cases:[{id:'case-1',name:'JSON output',assertion:'Output parses as JSON.',status:'passed',observed:'Valid JSON.'},{id:'case-2',name:'Required key',assertion:'The name property is present.',status:'failed',observed:'Name was missing.'}],...overrides});
afterEach(()=>setWorkspace(emptyWorkspace()));
test('provider metadata does not retain API keys, and endpoint validation rejects credential URLs',()=>{
  const p=makeProvider({...provider(),apiKey:'never-persist-this',password:'secret'});assert.equal(p.apiKey,undefined);assert.equal(p.password,undefined);assert.equal(p.baseUrl,'https://gateway.example/v1');for(const url of ['javascript:alert(1)','https://user:secret@example.com/v1','https://example.com/v1?key=secret','https://example.com/#key'])assert.throws(()=>endpointUrl(url));assert.equal(endpointUrl('http://127.0.0.1:8000/v1/'),'http://127.0.0.1:8000/v1');
});
test('catalog discovery deduplicates exact routes without generating benchmark results',()=>{
  const p=provider(),w=workspace(),data={data:[{id:'mypc/qwen'},{id:'mypc/qwen'},{id:'remote/llama'}]};const plan=planCatalog(data,p,w);assert.equal(plan.models.length,2);assert.ok(plan.models.every(m=>m.source==='catalog'&&!('passes'in m)&&!('latencies'in m)));const next={...w,models:plan.models};setWorkspace(next);assert.equal(filteredModels({source:'real'}).length,2);assert.ok(filteredModels({source:'real'}).every(m=>m.metrics===null));assert.equal(runs.length,24);assert.equal(planCatalog(data,p,next).models.length,0);
});
test('optional routing prefix applies to direct servers, and OmniRoute routing IDs stay exact',()=>{
  const p=makeProvider({name:'Local server',type:'local',prefix:'mypc'});assert.equal(normalizeCatalog({data:[{id:'qwen'}]},p)[0].route,'mypc/qwen');assert.equal(normalizeCatalog({data:[{id:'mypc/qwen'}]},p)[0].route,'mypc/qwen');assert.equal(normalizeCatalog(['qwen'],provider())[0].route,'qwen');
});
test('catalog sync uses one explicit authenticated request with omitted cookies and no redirects',async()=>{
  let recorded;const result=await fetchCatalog(provider(),'request-only-key',{fetchImpl:async(url,options)=>{recorded={url,options};return {ok:true,text:async()=>JSON.stringify({data:[{id:'mypc/qwen'}]})};}});assert.equal(result.length,1);assert.equal(recorded.url,'https://gateway.example/v1/models');assert.equal(recorded.options.headers.Authorization,'Bearer request-only-key');assert.equal(recorded.options.credentials,'omit');assert.equal(recorded.options.redirect,'error');assert.equal(recorded.options.method,'GET');assert.ok(!JSON.stringify(result).includes('request-only-key'));
});
test('HTTPS sync rejects mixed-content private HTTP addresses before any network request',async()=>{
  let calls=0;await assert.rejects(fetchCatalog({...provider(),baseUrl:'http://moe-instance:20128/v1'},'',{fetchImpl:async()=>{calls++}}),/Import catalog JSON/);assert.equal(calls,0);
});
test('sync handles authentication errors, malformed responses, and CORS failures without echoing upstream secrets',async()=>{
  await assert.rejects(fetchCatalog(provider(),'',{fetchImpl:async()=>({ok:false,status:401})}),/Authentication was rejected/);
  await assert.rejects(fetchCatalog(provider(),'',{fetchImpl:async()=>({ok:true,text:async()=>'<html>not json</html>'})}),/valid JSON/);
  await assert.rejects(fetchCatalog(provider(),'',{fetchImpl:async()=>{throw new TypeError('network secret')}}),/CORS/);
});
test('real report imports are atomic and reject synthetic flags, missing cases, invalid times and impossible metrics',()=>{
  const w=workspace();for(const bad of [{source:'synthetic'},{isSample:true},{id:'SYN-0001'},{cases:[]},{createdAt:'not a date'},{latencySeconds:-1},{latencySeconds:NaN},{configuration:{transport:'synthetic-fixture'}},{cases:[{id:'1',name:'Test',assertion:'A',status:'unknown'}]}])assert.throws(()=>prepareReports({runs:[report(),report({id:'run-2',...bad})]},w));assert.equal(w.reports.length,0);assert.equal(w.models.length,0);assert.throws(()=>prepareReports(reportTemplate(),w));
});
test('import recalculates scores from individual outcomes and registers models and custom suites',()=>{
  const plan=prepareReports(report({summary:{scorePercent:100}}),workspace());assert.equal(plan.models.length,1);const w=mergeReports(workspace(),plan);setWorkspace(w);const a=aggregate(w.models[0].id,'all','real');assert.equal(a.score,50);assert.equal(a.passed,1);assert.equal(a.total,2);assert.equal(a.latency,1.25);assert.equal(filteredModels({source:'synthetic'}).length,6);assert.equal(suites.find(s=>s.id==='my-coding').name,'My coding suite');
});
test('duplicate reports are idempotent and conflicting historical run IDs are rejected',()=>{
  const w=mergeReports(workspace(),prepareReports(report(),workspace()));assert.equal(prepareReports(report(),w).duplicates,1);assert.throws(()=>prepareReports(report({latencySeconds:9}),w),/different contents/);assert.equal(w.reports.length,1);
});
test('API keys and arbitrary configuration fields are excluded from persisted or exported normalized reports',()=>{
  const p=prepareReports(report({configuration:{temperature:0,maxOutputTokens:2048,timeoutMs:5000,apiKey:'do-not-save',headers:{Authorization:'secret'}},cases:[{id:'case-1',name:'Key redaction',assertion:'No secret',status:'passed',observed:'Authorization: Bearer abcdefghijklmno'}]}),workspace());const value=JSON.stringify(p);assert.ok(!value.includes('do-not-save'));assert.ok(!value.includes('abcdefghijklmno'));assert.ok(value.includes('[redacted]'));
});
test('provider/model/workspace storage round-trip retains real evidence without secrets',()=>{
  const w=mergeReports(workspace(),prepareReports(report(),workspace()));let raw;const storage={setItem:(k,v)=>{assert.equal(k,WORKSPACE_KEY);raw=v},getItem:()=>raw};saveWorkspace(w,storage);const restored=loadWorkspace(storage);assert.equal(restored.providers.length,1);assert.equal(restored.models.length,1);assert.equal(restored.reports.length,1);assert.equal(restored.reports[0].cases[0].status,'passed');assert.equal(loadWorkspace({getItem:()=>'{broken'}).loadError?.includes('not been overwritten'),true);
});
test('latest real report replaces historical weighting while preserving all run history',()=>{
  let w=mergeReports(workspace(),prepareReports(report(),workspace()));w=mergeReports(w,prepareReports(report({id:'run-2',createdAt:'2026-10-21T11:00:00Z',cases:report().cases.map(c=>({...c,status:'passed'}))}),w));setWorkspace(w);assert.equal(aggregate(w.models[0].id,'all','real').score,100);assert.equal(aggregate(w.models[0].id,'all','real').total,2);assert.equal(runs.filter(r=>r.source==='real').length,2);
});
test('comparisons use common suite versions, case assertions and settings, and never mix sources',()=>{
  let w=workspace();w=mergeReports(w,prepareReports({runs:[report(),report({id:'live-run-002',model:{name:'Local Llama',routingId:'mypc/llama',provider:'My OmniRoute'}})]},w));setWorkspace(w);const ids=w.models.map(m=>m.id);assert.deepEqual(comparisonData(ids,'all','real').suiteIds,['my-coding']);assert.equal(comparisonData(ids,'all','synthetic').suiteIds.length,0);w.reports[1].suiteVersion='2.0';setWorkspace(w);assert.equal(comparisonData(ids,'all','real').suiteIds.length,0);w.reports[1].suiteVersion='1.0';w.reports[1].cases=w.reports[1].cases.map(c=>({...c,assertion:'A different criterion'}));setWorkspace(w);assert.equal(comparisonData(ids,'all','real').suiteIds.length,0);
});
test('a report cannot point to one registered modelId while naming a different route or provider',()=>{
  const w=workspace();w.models=[makeModel({name:'Qwen',route:'mypc/qwen'},w.providers[0])];assert.throws(()=>prepareReports(report({modelId:w.models[0].id,model:{routingId:'different-model'}}),w),/different models/);
});
