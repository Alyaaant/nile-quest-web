/**
 * End-to-end production smoke check (no external npm packages).
 * Usage: TEST_URL=https://your-new-game-domain DEMO_EMAIL=... DEMO_PASSWORD=... npm run verify:live
 * This makes a single Egypt run in the dedicated demo account; it does not touch other apps.
 */
const base=process.env.TEST_URL?.replace(/\/$/,'');
const email=process.env.DEMO_EMAIL;
const password=process.env.DEMO_PASSWORD;
if(!base || !email || !password){
  console.error('TEST_URL, DEMO_EMAIL, DEMO_PASSWORD are required.');
  process.exit(2);
}
const parsed=new URL(base);
if(parsed.protocol!=='https:' && !['localhost','127.0.0.1'].includes(parsed.hostname)){
  console.error('For an externally hosted app, TEST_URL must use HTTPS.');
  process.exit(2);
}
let cookie='';
async function api(path,method='GET',payload){
 const resp=await fetch(`${base}${path}`,{
  method,
  headers:{...(payload?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},
  body:payload?JSON.stringify(payload):undefined,
  signal:AbortSignal.timeout(15_000)
 });
 if(resp.headers.get('set-cookie'))cookie=resp.headers.get('set-cookie').split(';')[0];
 const body=await resp.json();
 if(!resp.ok)throw Error(`${method} ${path}: ${resp.status} ${JSON.stringify(body)}`);
 return body;
}
try{
 const health=await api('/health');
 if(!health.ok)throw Error('Healthcheck failed');
 console.log('✓ Healthcheck');
 const auth=await api('/api/auth/login','POST',{email,password});
 if(!auth.user)throw Error('Login user missing');
 console.log('✓ Login');
 const world=await api('/api/world');
 if(world.stages?.length!==5)throw Error('Expected five stages');
 console.log('✓ Database / five stages');
 const run=await api('/api/runs/start','POST',{stageId:'egypt'});
 if(run.run?.question?.id!=='eg1')throw Error('Start question missing');
 const answer=await api('/api/runs/answer','POST',{runId:run.run.id,questionId:'eg1',choice:-1});
 if(answer.points!==0||answer.timedOut!==true)throw Error('Timed-out answer failed');
 console.log('✓ Persisted run + authoritative score');
 const weather=await api('/api/weather?stage=egypt');
 if(weather.available){
  console.log('✓ External Open-Meteo API (server route verified)');
  console.log('PASS: all four interview features have been exercised via API at',base);
 }else{
  console.warn('! Weather not verified via server:',weather.reason||weather.message||'unknown');
  console.warn('  Open the stage in a real browser to check the direct Open-Meteo fallback.');
  console.warn('PARTIAL PASS: login and persistence verified; external live API not yet verified.');
  process.exitCode=2;
 }
}catch(e){console.error('FAILED:',e.message);process.exitCode=1;}
