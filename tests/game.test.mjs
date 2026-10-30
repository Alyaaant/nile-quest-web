import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/server.mjs';
import {openDb,hashPassword,verifyPassword,provisionDemo} from '../src/db.mjs';
import {stages,questions,scoreAnswer,unlockIndex} from '../src/game.mjs';

test('game content: 5 stages with exactly 3 well-formed questions',()=>{
 assert.equal(stages.length,5);
 assert.deepEqual(stages.map(s=>s.id),Object.keys(questions));
 for(const stage of stages){assert.equal(questions[stage.id].length,3);for(const q of questions[stage.id]){assert.equal(q.options.length,4);assert.ok(q.correct>=0&&q.correct<=3);assert.ok(q.note.length>5);}}
 assert.deepEqual(scoreAnswer({correct:true,streak:0,remainingSeconds:12}),{points:112,nextStreak:1});
 assert.deepEqual(scoreAnswer({correct:true,streak:1,remainingSeconds:12}),{points:137,nextStreak:2});
 assert.equal(unlockIndex([]),0);
 assert.equal(unlockIndex([{stage_id:'egypt',completed:1}]),1);
});

test('password hashing uses a random salt and verifies',()=>{
 const a=hashPassword('your-secure-password');const b=hashPassword('your-secure-password');assert.notEqual(a,b);assert.ok(verifyPassword('your-secure-password',a));assert.equal(verifyPassword('invalid',a),false);
});

test('end-to-end login, unlocking, persistent score and authorization',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'nile-test-'));const db=openDb(dir);
 const app=createApp({db,mockWeather:async id=>({available:true,city:id,temperature:24,source:'mock'})});
 await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${app.address().port}`;let cookie='';
 const call=async(path,{method='GET',body,authed=true}={})=>{
  const headers={};if(body)headers['Content-Type']='application/json';if(authed&&cookie)headers.Cookie=cookie;
  const r=await fetch(base+path,{method,headers,body:body?JSON.stringify(body):undefined});
  if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];
  return {status:r.status,data:await r.json()};
 };
 try{
  const health=await call('/health');assert.equal(health.status,200);assert.equal(health.data.ok,true);
  assert.equal((await call('/api/world')).status,401);
  const register=await call('/api/auth/register',{method:'POST',body:{name:'Interview Tester',email:'test@example.com',password:'very-secure-password'}});
  assert.equal(register.status,200);assert.equal(register.data.user.name,'Interview Tester');
  assert.equal((await call('/api/auth/register',{method:'POST',body:{name:'Other',email:'test@example.com',password:'very-secure-password'}})).status,409);
  assert.equal((await call('/api/runs/start',{method:'POST',body:{stageId:'japan'}})).status,403);
  const weather=await call('/api/weather?stage=egypt');assert.equal(weather.data.temperature,24);
  for(const stage of stages){
   const start=await call('/api/runs/start',{method:'POST',body:{stageId:stage.id}});assert.equal(start.status,201);
   let run=start.data.run;assert.equal(run.stage.id,stage.id);assert.equal(run.question.index,0);
   for(let i=0;i<3;i++){
    const question=questions[stage.id][i],answer=await call('/api/runs/answer',{method:'POST',body:{runId:run.id,questionId:question.id,choice:question.correct}});
    assert.equal(answer.status,200,`${stage.id} question ${i}: ${JSON.stringify(answer.data)}`);
    assert.equal(answer.data.correct,true);if(i<2){
      assert.equal(answer.data.next.waiting,true);
      const next=await call('/api/runs/next',{method:'POST',body:{runId:run.id}});
      assert.equal(next.status,200);run=next.data.run;assert.equal(run.question.index,i+1);
    }else{assert.equal(answer.data.done,true);assert.equal(answer.data.cleared,true)}
   }
   const prog=await call('/api/world');assert.equal(prog.status,200);assert.ok(prog.data.stages.find(s=>s.id===stage.id).cleared);
  }
  const leaders=await call('/api/leaderboard');assert.ok(leaders.data.leaders.some(s=>s.name==='Interview Tester'&&s.stamps===5));
  const history=await call('/api/runs/history');assert.equal(history.data.runs.length,5);
  const revisit=await call('/api/runs/start',{method:'POST',body:{stageId:'egypt'}});
  assert.equal((await call('/api/runs/answer',{method:'POST',body:{runId:revisit.data.run.id,questionId:'eg1',choice:1}})).status,200);
  assert.equal((await call('/api/runs/answer',{method:'POST',body:{runId:revisit.data.run.id,questionId:'eg1',choice:1}})).status,409);
  const logout=await call('/api/auth/logout',{method:'POST'});assert.equal(logout.status,200);
  assert.equal((await call('/api/world')).status,401);
  const badLogin=await call('/api/auth/login',{method:'POST',body:{email:'test@example.com',password:'wrong'}});assert.equal(badLogin.status,401);
  const logged=await call('/api/auth/login',{method:'POST',body:{email:'test@example.com',password:'very-secure-password'}});assert.equal(logged.status,200);
  const world=await call('/api/world');assert.equal(world.data.stages.filter(s=>s.cleared).length,5);
  const html=await fetch(base+'/');assert.equal(html.status,200);assert.ok((await html.text()).includes('NILE QUEST'));
  const js=await fetch(base+'/app.js');assert.equal(js.status,200);assert.ok((await js.text()).includes('YOUR STAMPS'));
 }finally{await new Promise(resolve=>app.close(resolve));db.close();rmSync(dir,{recursive:true,force:true});}
});

test('security: expired questions never award points, origin checks, isolated accounts',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'nile-sec-'));const db=openDb(dir);
 const app=createApp({db,mockWeather:async id=>({available:true,city:id,temperature:25})});
 await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${app.address().port}`;
 const send=async(path,{method='GET',body,cookie,origin}={})=>{
  const headers={'X-Forwarded-For':'198.51.100.11'};
  if(body)headers['Content-Type']='application/json';
  if(cookie)headers.Cookie=cookie;
  if(origin)headers.Origin=origin;
  const r=await fetch(base+path,{method,headers,body:body?JSON.stringify(body):undefined});
  return {status:r.status,cookie:r.headers.get('set-cookie')?.split(';')[0]||'',data:await r.json()};
 };
 try{
  const blocked=await send('/api/auth/register',{method:'POST',origin:'https://hostile.example',body:{name:'Hostile',email:'hostile@example.com',password:'strong-password-123'}});
  assert.equal(blocked.status,403);
  const person1=await send('/api/auth/register',{method:'POST',body:{name:'Traveler 1',email:'person1@example.com',password:'strong-password-123'}});
  const person2=await send('/api/auth/register',{method:'POST',body:{name:'Traveler 2',email:'person2@example.com',password:'strong-password-123'}});
  assert.equal(person1.status,200);assert.equal(person2.status,200);
  assert.equal((await send('/api/runs/start',{method:'POST',cookie:person2.cookie,body:{stageId:'italy'}})).status,403);
  const game=await send('/api/runs/start',{method:'POST',cookie:person1.cookie,body:{stageId:'egypt'}});
  assert.equal(game.status,201);
  const stolen=await send('/api/runs/answer',{method:'POST',cookie:person2.cookie,body:{runId:game.data.run.id,questionId:'eg1',choice:1}});
  assert.equal(stolen.status,409);
  const timedOut=await send('/api/runs/answer',{method:'POST',cookie:person1.cookie,body:{runId:game.data.run.id,questionId:'eg1',choice:-1}});
  assert.equal(timedOut.status,200);
  assert.equal(timedOut.data.correct,false);assert.equal(timedOut.data.timedOut,true);assert.equal(timedOut.data.points,0);
  const premature=await send('/api/runs/answer',{method:'POST',cookie:person1.cookie,body:{runId:game.data.run.id,questionId:'eg2',choice:0}});
  assert.equal(premature.status,409);
  const second=await send('/api/runs/next',{method:'POST',cookie:person1.cookie,body:{runId:game.data.run.id}});
  assert.equal(second.status,200);
  db.prepare('UPDATE runs SET question_started=? WHERE id=?').run(Date.now()-30_000,game.data.run.id);
  const expired=await send('/api/runs/answer',{method:'POST',cookie:person1.cookie,body:{runId:game.data.run.id,questionId:'eg2',choice:0}});
  assert.equal(expired.status,200);assert.equal(expired.data.timedOut,true);assert.equal(expired.data.points,0);
  const invalid=await send('/api/runs/answer',{method:'POST',cookie:person1.cookie,body:{runId:game.data.run.id,questionId:'eg3',choice:9}});
  assert.equal(invalid.status,400);
  assert.equal((await send('/api/world',{cookie:'nile_session=%invalid-token'})).status,401);
 }finally{await new Promise(resolve=>app.close(resolve));db.close();rmSync(dir,{recursive:true,force:true});}
});

test('storage survives a restart, demo password can rotate safely',()=>{
 const dir=mkdtempSync(join(tmpdir(),'nile-persist-'));
 try{
  let db=openDb(dir);
  const userId='user-restart';
  db.prepare('INSERT INTO users VALUES (?,?,?,?,?)').run(userId,'Traveler','persistent@example.com',hashPassword('old-password-123'),Date.now());
  db.prepare('INSERT INTO progress VALUES (?,?,?,?,?,?)').run(userId,'egypt',347,1,1,Date.now());
  db.close();
  db=openDb(dir);
  assert.equal(db.prepare('SELECT best_score FROM progress WHERE user_id=?').get(userId).best_score,347);
  // Run the existing demo bootstrap with a dedicated account.
  provisionDemo(db,{DEMO_EMAIL:'demo@example.com',DEMO_PASSWORD:'password-123456',DEMO_NAME:'First'});
  let record=db.prepare('SELECT * FROM users WHERE email=?').get('demo@example.com');
  assert.ok(verifyPassword('password-123456',record.password_hash));
  provisionDemo(db,{DEMO_EMAIL:'demo@example.com',DEMO_PASSWORD:'password-654321',DEMO_NAME:'Updated'});
  record=db.prepare('SELECT * FROM users WHERE email=?').get('demo@example.com');
  assert.equal(record.name,'Updated');
  assert.ok(verifyPassword('password-654321',record.password_hash));
  assert.equal(verifyPassword('password-123456',record.password_hash),false);
  db.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
