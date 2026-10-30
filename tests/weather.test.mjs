import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/server.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDb} from '../src/db.mjs';

test('external API contract: weather is exposed through the public endpoint',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'nile-weather-')),db=openDb(dir);
 const app=createApp({db,mockWeather:async id=>({available:true,city:id,temperature:26,wind:8,code:2,source:'Open-Meteo'})});
 await new Promise(done=>app.listen(0,'127.0.0.1',done));
 try{
  const origin=`http://127.0.0.1:${app.address().port}`;
  const response=await fetch(`${origin}/api/weather?stage=italy`);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{available:true,city:'italy',temperature:26,wind:8,code:2,source:'Open-Meteo'});
  const missing=await fetch(`${origin}/api/weather?stage=unknown`);
  assert.equal(missing.status,404);
  const page=await fetch(origin);const csp=page.headers.get('content-security-policy');
  assert.match(csp,/connect-src 'self' https:\/\/api\.open-meteo\.com/);
 }finally{await new Promise(done=>app.close(done));db.close();rmSync(dir,{recursive:true,force:true});}
});
