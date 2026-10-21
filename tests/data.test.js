import test from 'node:test';
import assert from 'node:assert/strict';
import {models,suites,runs,aggregate,filteredModels,median} from '../out/data.js';

test('every sample run has a unique ID, source, complete cases, and an explicit no-inference provenance',()=>{
  assert.equal(new Set(runs.map(r=>r.id)).size,24);
  for(const r of runs){assert.equal(r.source,'synthetic');assert.equal(r.isSample,true);assert.match(r.provenance,/No model inference/);assert.equal(r.cases.length,suites.find(s=>s.id===r.suiteId).cases.length);assert.equal(new Set(r.cases.map(c=>c.id)).size,r.cases.length);assert.ok(r.cases.every(c=>['passed','failed','timeout'].includes(c.status)));}
});
test('case-weighted scores and per-suite results are calculated from outcomes',()=>{
  const a=aggregate('qwen-coder');assert.equal(a.total,40);assert.equal(a.passed,37);assert.equal(a.score,92.5);assert.equal(aggregate('qwen-coder','coding').score,100*11/12);assert.equal(a.latency,1.31);
});
test('real results cannot fall back to synthetic fixtures',()=>{for(const m of models){assert.equal(aggregate(m.id,'all','real'),null);}assert.deepEqual(filteredModels({source:'real'}),[]);});
test('provider, suite, and search filters compose without changing comparison aggregates',()=>{
  const list=filteredModels({provider:'NVIDIA NIM',suite:'arabic',query:'qwen'});assert.equal(list.length,2);assert.ok(list.every(m=>m.provider==='NVIDIA NIM'&&m.metrics.total===10));assert.equal(filteredModels({query:'DOES-NOT-EXIST'}).length,0);assert.equal(aggregate('qwen-coder').passed,37);
});
test('sort respects score, latency, and model name',()=>{
  assert.equal(filteredModels({})[0].id,'qwen-coder');assert.equal(filteredModels({sort:'latency'})[0].id,'mistral');assert.equal(filteredModels({sort:'name'})[0].id,'deepseek');
});
test('response completion counts assertion failures but excludes timeouts',()=>{const a=aggregate('mistral','reasoning');assert.equal(a.responseRate,90);assert.equal(a.score,70);assert.equal(aggregate('qwen-coder').responseRate,100);});
test('median handles odd, even, and empty input without mutating values',()=>{const a=[3,1,2,4];assert.equal(median(a),2.5);assert.deepEqual(a,[3,1,2,4]);assert.equal(median([5,1,2]),2);assert.equal(median([]),null);});
