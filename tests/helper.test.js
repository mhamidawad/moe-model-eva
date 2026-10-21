import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
test('downloadable export helper fetches a private catalog and writes no credentials',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'omniroute-catalog-test-'));let request;
  const server=http.createServer((req,res)=>{request={url:req.url,key:req.headers.authorization};res.setHeader('content-type','application/json');res.end(JSON.stringify({data:[{id:'local/test-model'}]}));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{const base=`http://127.0.0.1:${server.address().port}/v1`;const child=spawn(process.execPath,[path.resolve('out/helpers/export-catalog.mjs')],{cwd:dir,env:{...process.env,OMNIROUTE_BASE_URL:base,OMNIROUTE_API_KEY:'helper-test-only-key'}});let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);const code=await new Promise(resolve=>child.on('exit',resolve));assert.equal(code,0,output);assert.deepEqual(request,{url:'/v1/models',key:'Bearer helper-test-only-key'});const saved=await readFile(path.join(dir,'omniroute-catalog.json'),'utf8');assert.equal(JSON.parse(saved).data[0].id,'local/test-model');assert.ok(!saved.includes('helper-test-only-key'));assert.ok(!output.includes('helper-test-only-key'));assert.equal((await stat(path.join(dir,'omniroute-catalog.json'))).mode&0o777,0o600);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
});
