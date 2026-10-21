export const models = [
  {id:'qwen-coder',name:'Qwen3 Coder',route:'nim/qwen3-coder',provider:'NVIDIA NIM',family:'Qwen',glyph:'Q',color:'#8870ba',bg:'#f0ebf8',tags:['Coding','Tool use'],context:'256K',description:'A coding-focused candidate for agentic development workflows.',passes:[11,9,8,9],latencies:[1.24,1.83,.71,1.38],timeouts:[0,0,0,0]},
  {id:'deepseek',name:'DeepSeek V3.1',route:'or/deepseek-v3.1',provider:'OpenRouter',family:'DeepSeek',glyph:'≈',color:'#5c86bb',bg:'#edf3fb',tags:['Reasoning','Coding'],context:'128K',description:'A general-purpose candidate for code, reasoning, and planning.',passes:[10,9,7,8],latencies:[1.72,2.24,.92,1.66],timeouts:[0,0,0,0]},
  {id:'qwen-32b',name:'Qwen3 32B',route:'nim/qwen3-32b',provider:'NVIDIA NIM',family:'Qwen',glyph:'Q',color:'#ad80a4',bg:'#f7edf5',tags:['Multilingual','Reasoning'],context:'128K',description:'A multilingual candidate for Arabic and structured tasks.',passes:[9,8,7,9],latencies:[.98,1.49,.64,1.09],timeouts:[0,0,0,0]},
  {id:'llama',name:'Llama 3.3 70B',route:'nim/llama-3.3-70b',provider:'NVIDIA NIM',family:'Llama',glyph:'∞',color:'#638ca7',bg:'#edf4f7',tags:['General','Instruction'],context:'128K',description:'A general-purpose instruction-following candidate.',passes:[9,8,7,7],latencies:[1.48,1.91,.84,1.52],timeouts:[0,0,0,1]},
  {id:'mistral',name:'Mistral Small 3.1',route:'or/mistral-small-3.1',provider:'OpenRouter',family:'Mistral',glyph:'M',color:'#c58c4e',bg:'#fbf1e6',tags:['Fast','Structured'],context:'128K',description:'A compact candidate for responsive structured workflows.',passes:[8,7,8,7],latencies:[.73,1.12,.48,.88],timeouts:[0,1,0,0]},
  {id:'gemma',name:'Gemma 3 27B',route:'or/gemma-3-27b',provider:'OpenRouter',family:'Gemma',glyph:'◇',color:'#75a58c',bg:'#ecf5ed',tags:['General','Multilingual'],context:'128K',description:'A general-purpose candidate for everyday assistant tasks.',passes:[8,7,6,8],latencies:[.87,1.28,.57,.96],timeouts:[0,0,0,1]},
];

const makeCases = entries => entries.map(([name,assertion])=>({name,assertion}));
export const suites = [
  {id:'coding',name:'Coding & debugging',short:'Coding',icon:'code',version:'1.0',description:'Practical development tasks, from fixing a regression to preserving the contract of an API.',cases:makeCases([
    ['Environment-variable override','Uses the provided environment value and retains the default fallback.'],
    ['Request timeout cleanup','Aborts a slow request and clears the timeout on every completion path.'],
    ['JWT middleware guard','Returns 401 for a missing token without running the protected handler.'],
    ['Stable pagination','Returns the requested page with deterministic ordering.'],
    ['Secret redaction','Removes API keys from error messages without losing useful context.'],
    ['Injected transport','Uses the supplied fetch implementation without opening a network socket.'],
    ['Schema validation','Rejects invalid input with a structured validation error.'],
    ['Retry boundary','Retries transient failures within the configured attempt limit.'],
    ['Database transaction','Rolls back every write when the second operation fails.'],
    ['Type-safe route contract','Preserves the documented response shape for success and error paths.'],
    ['Streaming parser','Handles JSON fragments that cross chunk boundaries.'],
    ['Concurrent cancellation','Cancels outstanding work without unhandled promise rejections.'],
  ])},
  {id:'reasoning',name:'Reasoning & planning',short:'Reasoning',icon:'spark',version:'1.0',description:'Constraint-aware planning, trade-offs, and consistent decisions under incomplete information.',cases:makeCases([
    ['Zero-budget deployment','Produces a deployment plan within a zero-budget constraint.'],
    ['Dependency ordering','Orders migration tasks so all prerequisites are satisfied.'],
    ['Evidence over assumptions','Distinguishes observed facts from unresolved hypotheses.'],
    ['Capacity planning','Chooses a configuration within the stated memory limit.'],
    ['Failure triage','Prioritizes a reproduced root cause over unrelated warnings.'],
    ['Rollback strategy','Includes an explicit rollback trigger and recoverable state.'],
    ['Conflicting constraints','Identifies and explains an unsatisfiable requirement.'],
    ['Scheduling','Constructs a schedule without overlapping exclusive resources.'],
    ['Trade-off analysis','Compares options against the same decision criteria.'],
    ['Long-horizon consistency','Keeps earlier constraints intact through the final recommendation.'],
  ])},
  {id:'structured',name:'Structured output',short:'Structured',icon:'braces',version:'1.0',description:'Schema-conformant JSON, predictable tool arguments, and clean machine-readable responses.',cases:makeCases([
    ['JSON-only response','Returns parseable JSON with no surrounding Markdown.'],
    ['Required properties','Includes every required schema property.'],
    ['Enum boundaries','Uses only values listed in the schema enum.'],
    ['Nested schema','Validates nested arrays and objects recursively.'],
    ['Nullable values','Distinguishes explicit null from an absent property.'],
    ['Unicode preservation','Preserves Arabic characters and escaped strings.'],
    ['Tool arguments','Produces valid arguments matching the declared tool schema.'],
    ['No additional properties','Omits fields not permitted by the schema.'],
  ])},
  {id:'arabic',name:'Arabic & RTL',short:'Arabic & RTL',icon:'language',version:'1.0',description:'Arabic instructions, mixed-script content, and practical right-to-left interface behavior.',cases:makeCases([
    ['Arabic instructions','Responds to an Arabic instruction in fluent Arabic.'],
    ['RTL layout direction','Uses a right-to-left document direction when requested.'],
    ['Mixed-script identifiers','Preserves English code identifiers within Arabic prose.'],
    ['Currency formatting','Formats a sample amount with the requested SDG currency label.'],
    ['Arabic form labels','Uses clear Arabic labels for the requested form fields.'],
    ['Semantic navigation','Keeps navigation order consistent with right-to-left reading.'],
    ['Unicode JSON','Returns valid JSON containing intact Arabic values.'],
    ['Technical translation','Preserves the meaning of technical terms.'],
    ['Accessible RTL controls','Includes accessible Arabic labels for interface controls.'],
    ['Bidirectional punctuation','Handles punctuation and numbers consistently in mixed text.'],
  ])},
];

export const runs = models.flatMap((model,mi)=>suites.map((suite,si)=>{
  const cases=suite.cases.map((c,i)=>{
    const status=i<model.passes[si]?'passed':model.timeouts[si] && i===suite.cases.length-1?'timeout':'failed';
    return {id:`${suite.id}-${String(i+1).padStart(2,'0')}`,name:c.name,assertion:c.assertion,status,
      observed:status==='passed'?'Sample response satisfied the assertion.':status==='timeout'?'Sample request exceeded the 5,000 ms timeout.':'Sample response did not satisfy the assertion.'};
  });
  return {id:`SYN-${String(mi*4+si+1).padStart(4,'0')}`,modelId:model.id,suiteId:suite.id,source:'synthetic',isSample:true,
    createdAt:`2026-10-20T${String(9+mi).padStart(2,'0')}:${String(si*12).padStart(2,'0')}:00Z`,
    provenance:'Representative fixture. No model inference was performed.',
    suiteVersion:suite.version,latencySeconds:model.latencies[si],cases,
    configuration:{temperature:0,maxOutputTokens:2048,timeoutMs:5000,transport:'synthetic-fixture',routingId:model.route},
  };
}));

export const score = run => 100*run.cases.filter(c=>c.status==='passed').length/run.cases.length;
export const median = values => { if(!values.length)return null; const s=[...values].sort((a,b)=>a-b);const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2; };
const sampleModels=[...models],sampleRuns=[...runs],sampleSuites=[...suites];
export function setWorkspace(workspace){
  models.splice(0,models.length,...sampleModels,...workspace.models);
  runs.splice(0,runs.length,...sampleRuns,...workspace.reports);
  suites.splice(0,suites.length,...sampleSuites);
  for(const r of workspace.reports)if(!suites.some(s=>s.id===r.suiteId))suites.push({id:r.suiteId,name:r.suiteName,short:r.suiteName,version:r.suiteVersion,icon:'layers',description:'An evaluation suite included in your imported real reports.',cases:r.cases,imported:true});
}
export function aggregateRuns(selected){
  if(!selected.length)return null;
  const cases=selected.flatMap(r=>r.cases),passed=cases.filter(c=>c.status==='passed').length;
  return {score:100*passed/cases.length,passed,total:cases.length,responseRate:100*cases.filter(c=>!['timeout','error'].includes(c.status)).length/cases.length,latency:median(selected.map(r=>r.latencySeconds)),runs:selected};
}
export function latestRuns(modelId,suiteId='all',source='synthetic'){
  const selected=runs.filter(r=>r.modelId===modelId&&(suiteId==='all'||r.suiteId===suiteId)&&r.source===source).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
  const seen=new Set();return selected.filter(r=>{if(seen.has(r.suiteId))return false;seen.add(r.suiteId);return true;});
}
export function aggregate(modelId, suiteId='all', source='synthetic') {
  return aggregateRuns(latestRuns(modelId,suiteId,source));
}
export function comparisonData(modelIds,suiteId,source){
  const byModel=modelIds.map(id=>latestRuns(id,suiteId,source));
  const signature=r=>JSON.stringify([r.suiteVersion,[...r.cases].sort((a,b)=>a.id.localeCompare(b.id)).map(c=>[c.id,c.assertion]),...['temperature','maxOutputTokens','timeoutMs'].map(k=>r.configuration[k]??null)]);
  const compatible=(byModel[0]||[]).filter(r=>byModel.every(rs=>{const match=rs.find(x=>x.suiteId===r.suiteId);return match&&signature(match)===signature(r)&&(source==='synthetic'||['temperature','maxOutputTokens','timeoutMs'].every(k=>typeof match.configuration[k]==='number'));}));
  const suiteIds=compatible.map(r=>r.suiteId);
  return {suiteIds,columns:modelIds.map((id,i)=>({modelId:id,metrics:aggregateRuns(byModel[i].filter(r=>suiteIds.includes(r.suiteId)))}))};
}
export function filteredModels({query='',provider='all',suite='all',source='synthetic',sort='score'}) {
  const q=query.trim().toLowerCase();
  return models.filter(m=>(provider==='all'||m.provider===provider)&&(!q||[m.name,m.route,m.provider,...m.tags].join(' ').toLowerCase().includes(q)))
    .map(m=>({...m,metrics:aggregate(m.id,suite,source)})).filter(m=>m.metrics||(source==='real'&&m.source==='catalog'&&suite==='all'))
    .sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='latency'?(a.metrics?.latency??Infinity)-(b.metrics?.latency??Infinity):((b.metrics?.score??-1)-(a.metrics?.score??-1))||a.name.localeCompare(b.name));
}
