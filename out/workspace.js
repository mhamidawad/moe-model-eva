// Persistent records contain connection metadata and reports, never API keys.
// Keep the original storage key so existing workspaces survive the rebrand.
export const WORKSPACE_KEY='omniroute-workspace-v2';
export const emptyWorkspace=()=>({version:2,providers:[],models:[],reports:[],updatedAt:null});
const text=(v,label,max=300)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(`${label} is required (maximum ${max} characters).`);return v.trim();};
const optional=(v,max=1000)=>typeof v==='string'?v.slice(0,max):'';
const scrub=v=>optional(v,3000).replace(/Bearer\s+\S+/gi,'Bearer [redacted]').replace(/(?:nvapi-|sk-)[A-Za-z0-9_-]{12,}/g,'[redacted]');
const enumValue=(v,values,label)=>{if(!values.includes(v))throw Error(`Invalid ${label}.`);return v;};
const number=(v,label)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw Error(`${label} must be a non-negative number.`);return v;};
const pid=name=>'provider:'+name.toLowerCase().trim();
const mid=(providerId,route)=>`model:${providerId}:${route}`;
const types=['omniroute','remote','self-hosted','local','imported'];
export function endpointUrl(value){if(!value)return '';let u;try{u=new URL(value);}catch{throw Error('Enter a full http:// or https:// base URL.');}if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)throw Error('Use an HTTP(S) URL without credentials, query parameters, or fragments.');return u.href.replace(/\/+$/,'');}
export function makeProvider(input,workspace=emptyWorkspace()){
  const name=text(input.name,'Provider name',80),id=input.id?text(input.id,'Provider ID',200):pid(name);
  if(workspace.providers.some(p=>p.id!==id&&p.name.toLowerCase()===name.toLowerCase()))throw Error('That provider name is already in use.');
  return {id,name,type:enumValue(input.type||'omniroute',types,'provider type'),baseUrl:endpointUrl(input.baseUrl||''),prefix:optional(input.prefix,80).trim(),lastSyncedAt:input.lastSyncedAt||null};
}
export function makeModel(input,provider){
  if(!provider)throw Error('Add or select a provider first.');
  const route=text(input.route||input.routingId||input.id,'Model routing ID',250);
  const tags=Array.isArray(input.tags)?input.tags:typeof input.tags==='string'?input.tags.split(','):[];
  return {id:mid(provider.id,route),name:text(input.name||route,'Model name',160),route,providerId:provider.id,provider:provider.name,source:'catalog',isSample:false,tags:tags.filter(t=>typeof t==='string'&&t.trim()).slice(0,6).map(t=>t.trim().slice(0,30)),family:optional(input.family,80),description:optional(input.description,500),context:optional(input.context,30),glyph:'◈',color:'#41745b',bg:'#edf5ed'};
}
export function normalizeCatalog(payload,provider){
  let entries=Array.isArray(payload)?payload:Array.isArray(payload?.data)?payload.data:Array.isArray(payload?.models)?payload.models:null;
  if(!entries)throw Error('Expected an OpenAI /v1/models response with a data array, a models array, or an array of model IDs.');
  if(entries.length>5000)throw Error('The catalog exceeds the 5,000-model limit.');
  const result=[],seen=new Set();
  for(const entry of entries){const raw=typeof entry==='string'?entry:entry?.id||entry?.modelId;let route=text(raw,'Catalog model ID',250);if(provider.type!=='omniroute'&&provider.prefix&&!route.startsWith(provider.prefix+'/'))route=provider.prefix+'/'+route;const m=makeModel({route,name:typeof entry==='object'?(entry.name||entry.modelName||raw):raw,tags:['Catalog']},provider);if(!seen.has(m.id)){seen.add(m.id);result.push(m);}}
  return result;
}
export function planCatalog(payload,provider,workspace){
  const candidates=normalizeCatalog(payload,provider);const added=candidates.filter(m=>!workspace.models.some(x=>x.id===m.id));
  return {models:added,existing:candidates.length-added.length,total:candidates.length,providerId:provider.id};
}
export async function fetchCatalog(provider,apiKey='',{fetchImpl=globalThis.fetch,pageProtocol='https:',signal}={}){
  const base=endpointUrl(provider.baseUrl);if(!base)throw Error('Set a base URL for this provider first.');
  if(pageProtocol==='https:'&&new URL(base).protocol!=='https:')throw Error('This HTTPS gallery cannot sync an HTTP endpoint. Use Import catalog JSON from your VM or local machine.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();
  try{const headers={Accept:'application/json'};if(apiKey.trim())headers.Authorization='Bearer '+apiKey.trim();const response=await fetchImpl(base+'/models',{method:'GET',headers,credentials:'omit',mode:'cors',redirect:'error',signal:controller.signal});if(!response.ok)throw Error(response.status===401||response.status===403?'Authentication was rejected. Check the connection key.':`Catalog request failed (HTTP ${response.status}).`);const data=await response.text();if(data.length>5_000_000)throw Error('Catalog response exceeds 5 MB.');let parsed;try{parsed=JSON.parse(data);}catch{throw Error('The endpoint did not return valid JSON.');}return normalizeCatalog(parsed,provider);
  }catch(e){if(e.name==='AbortError')throw Error('Catalog sync was cancelled or timed out.');if(e instanceof TypeError)throw Error('The endpoint could not be reached. Check HTTPS, CORS, and network access, or import a catalog JSON file.');throw e;
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export function prepareReports(payload,workspace){
  const entries=Array.isArray(payload)?payload:Array.isArray(payload?.runs)?payload.runs:payload?.source?[payload]:null;
  if(!entries?.length||entries.length>500)throw Error('Import one real report or a runs array containing 1–500 reports.');
  const providers=[...workspace.providers],models=[...workspace.models],reports=[],seen=new Map(workspace.reports.map(r=>[r.id,r]));let duplicates=0;
  for(const [index,r] of entries.entries()){
    try{
      if(r.source!=='real'||r.isSample!==false||r.configuration?.transport==='synthetic-fixture')throw Error('Only source: "real" with isSample: false is accepted. Synthetic reports cannot be relabeled.');
      const id=text(r.id,'Run ID',180);if(/^SYN[-:]/i.test(id))throw Error('Synthetic run IDs are not accepted as real reports.');
      const createdAt=text(r.createdAt,'Run timestamp',60);if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(createdAt)||!Number.isFinite(Date.parse(createdAt)))throw Error('Run timestamp must be a valid ISO date including a timezone.');
      const suiteId=text(r.suiteId||r.suite?.id,'Suite ID',100),suiteVersion=text(r.suiteVersion||r.suite?.version,'Suite version',80);
      let m=models.find(m=>m.id===r.modelId);
      if(m&&r.model){const route=r.model.routingId||r.model.route;if(route&&route!==m.route)throw Error('The report modelId and routing ID refer to different models.');if(r.model.provider&&r.model.provider!==m.provider)throw Error('The report modelId and provider refer to different providers.');}
      if(!m){const info=r.model;if(!info||typeof info!=='object')throw Error('Provide a model object with name, routingId, and provider, or an existing modelId.');const providerName=text(info.provider||r.provider,'Model provider',80);let provider=providers.find(p=>p.name.toLowerCase()===providerName.toLowerCase());if(!provider){provider=makeProvider({name:providerName,type:'imported'});providers.push(provider);}m=makeModel({name:info.name,route:info.routingId||info.route},provider);if(!models.some(x=>x.id===m.id))models.push(m);}
      if(!Array.isArray(r.cases)||!r.cases.length||r.cases.length>2000)throw Error('Each report must include 1–2,000 test cases; summary-only reports cannot establish a score.');
      const ids=new Set(),cases=r.cases.map(c=>{const cid=text(c.id,'Case ID',160);if(ids.has(cid))throw Error('Case IDs must be unique within a report.');ids.add(cid);return {id:cid,name:text(c.name,'Case name',250),assertion:text(c.assertion,'Case assertion',1500),status:enumValue(c.status,['passed','failed','timeout','error'],'case status'),observed:scrub(c.observed)};});
      const config=r.configuration||{},clean={transport:'imported-live',routingId:m.route};for(const k of ['temperature','maxOutputTokens','timeoutMs'])if(config[k]!==undefined)clean[k]=number(config[k],k);
      const normalized={id,modelId:m.id,suiteId,suiteName:optional(r.suite?.name||r.suiteName,160)||suiteId,suiteVersion,source:'real',isSample:false,createdAt:new Date(createdAt).toISOString(),latencySeconds:number(r.latencySeconds??r.summary?.medianRequestLatencySeconds,'Measured median request latency'),cases,configuration:clean,provenance:scrub(r.provenance)||'Live inference declared by the report uploader.',importedAt:new Date().toISOString()};
      const previous=seen.get(id);if(previous){const stable=x=>JSON.stringify({...x,importedAt:undefined});if(stable(previous)!==stable(normalized))throw Error(`Run ID ${id} already exists with different contents. Use a unique run ID.`);duplicates++;continue;}seen.set(id,normalized);reports.push(normalized);
    }catch(e){throw Error(`Report ${index+1}: ${e.message}`);}
  }
  return {providers:providers.filter(p=>!workspace.providers.some(x=>x.id===p.id)),models:models.filter(m=>!workspace.models.some(x=>x.id===m.id)),reports,duplicates};
}
export function mergeReports(workspace,plan){return {...workspace,providers:[...workspace.providers,...plan.providers],models:[...workspace.models,...plan.models],reports:[...workspace.reports,...plan.reports],updatedAt:new Date().toISOString()};}
export function saveWorkspace(workspace,storage=globalThis.localStorage){const safe={version:2,providers:workspace.providers.map(p=>makeProvider(p)),models:workspace.models.map(m=>makeModel(m,workspace.providers.find(p=>p.id===m.providerId))),reports:workspace.reports,updatedAt:new Date().toISOString()};try{storage.setItem(WORKSPACE_KEY,JSON.stringify(safe));}catch{throw Error('Browser storage is full or unavailable. Export your workspace before closing this page.');}return safe;}
export function loadWorkspace(storage=globalThis.localStorage){try{const raw=storage.getItem(WORKSPACE_KEY);if(!raw)return emptyWorkspace();const w=JSON.parse(raw);if(w.version!==2||!Array.isArray(w.providers)||!Array.isArray(w.models)||!Array.isArray(w.reports))throw Error('Invalid saved workspace.');const providers=w.providers.map(p=>makeProvider(p));const models=w.models.map(m=>makeModel(m,providers.find(p=>p.id===m.providerId)));const base={version:2,providers,models,reports:[],updatedAt:w.updatedAt};const plan=w.reports.length?prepareReports(w.reports,base):{reports:[]};return {...base,reports:plan.reports};}catch(e){return {...emptyWorkspace(),loadError:'Saved workspace could not be loaded. Your existing browser data has not been overwritten.'};}}
export function reportTemplate(){return {schemaVersion:'1.0',source:'real',isSample:false,id:'REPLACE-WITH-UNIQUE-RUN-ID',createdAt:'REPLACE-WITH-ISO-TIMESTAMP',model:{name:'Your model name',routingId:'your-prefix/exact-model-id',provider:'Your provider name'},suite:{id:'your-suite-id',name:'Your evaluation suite',version:'1.0'},provenance:'Describe the actual inference runner and evaluation method.',latencySeconds:null,configuration:{temperature:0,maxOutputTokens:2048,timeoutMs:5000},cases:[{id:'case-1',name:'Your test case',assertion:'State the exact pass criterion.',status:'REPLACE-WITH-passed-failed-timeout-or-error',observed:'Describe the measured result. Do not include credentials.'}]};}
