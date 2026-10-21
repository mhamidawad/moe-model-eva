#!/usr/bin/env node
// Run on a machine that can reach OmniRoute. No packages or build step required.
// OMNIROUTE_BASE_URL=http://moe-instance:20128/v1 node export-catalog.mjs
// Reads OMNIROUTE_API_KEY from the environment; never prints or saves the key.
import {writeFile} from 'node:fs/promises';
const base=process.env.OMNIROUTE_BASE_URL;
if(!base){console.error('Set OMNIROUTE_BASE_URL to your API base URL including /v1.');process.exit(1);}
let url;try{url=new URL(base);}catch{console.error('Invalid API base URL.');process.exit(1);}
if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash){console.error('Use an HTTP(S) URL without embedded credentials, query, or fragment.');process.exit(1);}
const headers={Accept:'application/json'};if(process.env.OMNIROUTE_API_KEY)headers.Authorization='Bearer '+process.env.OMNIROUTE_API_KEY;
try{const response=await fetch(url.href.replace(/\/+$/,'')+'/models',{headers,redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(`Catalog request failed (HTTP ${response.status}).`);const body=await response.text();if(body.length>5_000_000)throw Error('Catalog exceeds 5 MB.');const data=JSON.parse(body);if(!Array.isArray(data.data)&&!Array.isArray(data.models)&&!Array.isArray(data))throw Error('No model list found in the API response.');await writeFile('omniroute-catalog.json',JSON.stringify(data,null,2),{mode:0o600});console.log('Saved omniroute-catalog.json. Import it using Catalog sync → Choose catalog JSON. No inference was performed.');}catch(error){console.error(error.name==='TimeoutError'?'Catalog request timed out.':'Catalog export failed. Check connectivity, authentication, and the /v1 base URL.');process.exitCode=1;}
