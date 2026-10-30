import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join,extname,normalize} from 'node:path';
import {openDb,hashPassword,verifyPassword,makeToken,tokenHash,newId,now,provisionDemo} from './db.mjs';
import {stages,questions,getQuestion,stageById,publicStages,publicQuestion,scoreAnswer,unlockIndex} from './game.mjs';

const siteDir=join(dirname(dirname(fileURLToPath(import.meta.url))),'public');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
const error=(status,message)=>Object.assign(new Error(message),{status});
const SESSION_AGE=7*24*60*60*1000;
const QUIZ_LIMIT=20_000;
const MAX_BODY=16*1024;
const attempts=new Map();
const weatherCache=new Map();
const WEATHER_TTL=10*60*1000;
const WEATHER_TIMEOUT=8000;

function headers(res,extra={}){
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://api.open-meteo.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  res.setHeader('Cache-Control','no-store');
  for(const [k,v] of Object.entries(extra))res.setHeader(k,v);
}
function json(res,status,payload){headers(res,{'Content-Type':'application/json; charset=utf-8'});res.writeHead(status);res.end(JSON.stringify(payload));}
function cookieToken(req){const cookies=(req.headers.cookie||'').split(';');const entry=cookies.find(s=>s.trim().startsWith('nile_session='));if(!entry)return null;try{return decodeURIComponent(entry.trim().slice(13));}catch{return null;}}
function clearCookie(res){res.setHeader('Set-Cookie','nile_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure');}
function setCookie(res,token,secure){res.setHeader('Set-Cookie',`nile_session=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_AGE/1000}; HttpOnly; SameSite=Lax${secure?'; Secure':''}`);}
function currentUser(db,req){const t=cookieToken(req);if(!t)return null;return db.prepare('SELECT u.id,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(tokenHash(t),now())||null;}
function requireUser(db,req){const u=currentUser(db,req);if(!u)throw error(401,'ログインしてください。');return u;}
function progress(db,userId){return db.prepare('SELECT * FROM progress WHERE user_id=?').all(userId);}
function safeUser(user){return user?{id:user.id,name:user.name}:null;}
function activeRun(db,userId){return db.prepare("SELECT * FROM runs WHERE user_id=? AND status='active' ORDER BY started_at DESC LIMIT 1").get(userId)||null;}
function publicRun(r){if(!r)return null;const stage=stageById(r.stage_id);const waiting=r.question_started===0;const q=waiting?null:getQuestion(r.stage_id,r.question_index);return {id:r.id,stage,waiting,question:q?publicQuestion(q,r.question_index,3):null,questionStarted:r.question_started,limitMs:QUIZ_LIMIT,score:r.total_score,correct:r.correct_count,answered:r.question_index};}
function completedRun(r){return {id:r.id,stage:stageById(r.stage_id),score:r.total_score,correct:r.correct_count,cleared:r.correct_count>=2,startedAt:r.started_at,completedAt:r.completed_at};}
async function parseJson(req){let data='';for await(const chunk of req){data+=chunk;if(data.length>MAX_BODY)throw error(413,'リクエストが大きすぎます。');}try{return JSON.parse(data||'{}');}catch{throw error(400,'JSON形式が正しくありません。');}}
function rateLimit(req,action,limit=10,windowMs=15*60*1000){const ip=req.headers['x-forwarded-for']?.split(',')[0]?.trim()||req.socket.remoteAddress||'local';const key=action+ip;const n=now(),recent=(attempts.get(key)||[]).filter(t=>n-t<windowMs);if(recent.length>=limit)throw error(429,'試行回数が多すぎます。少し時間を空けてください。');recent.push(n);attempts.set(key,recent);if(attempts.size>10000)attempts.clear();}
function checkOrigin(req){const origin=req.headers.origin;if(!origin)return;const host=req.headers['x-forwarded-host']||req.headers.host;if(!host)throw error(403,'アクセスできません。');const o=new URL(origin);if(o.host!==host)throw error(403,'異なるサイトからの操作はできません。');}
async function weather(stageId){
  const stage=stageById(stageId);
  if(!stage)throw error(404,'国が見つかりません。');
  const cached=weatherCache.get(stageId);
  if(cached&&now()-cached.at<WEATHER_TTL)return cached.value;
  const [latitude,longitude]=stage.coords;
  const query=new URLSearchParams({latitude:String(latitude),longitude:String(longitude),current:'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',timezone:'auto'});
  try{
    const response=await fetch(`https://api.open-meteo.com/v1/forecast?${query}`,{signal:AbortSignal.timeout(WEATHER_TIMEOUT),headers:{Accept:'application/json'}});
    if(!response.ok)throw Object.assign(Error('weather upstream HTTP error'),{code:`HTTP_${response.status}`});
    const current=(await response.json()).current;
    if(typeof current?.temperature_2m!=='number')throw Object.assign(Error('invalid Open-Meteo payload'),{code:'INVALID_DATA'});
    const value={available:true,city:stage.city,temperature:Math.round(current.temperature_2m),wind:Math.round(current.wind_speed_10m||0),code:current.weather_code,observedAt:current.time,source:'Open-Meteo',retrievedAt:new Date().toISOString()};
    weatherCache.set(stageId,{at:now(),value});
    return value;
  }catch(e){
    // Do not fabricate live weather. Client can retry the same public API from the browser.
    const reason=e?.name==='TimeoutError'?'TIMEOUT':String(e?.code||e?.cause?.code||'NETWORK_ERROR').slice(0,40);
    console.warn('[weather] Failed for',stageId,reason);
    if(cached)return {...cached.value,stale:true,message:'以前取得した天気を表示しています。'};
    return {available:false,city:stage.city,message:'天気APIに接続できませんでした。',source:'Open-Meteo',reason};
  }
}
function checkCredentials({email,password}){
  if(typeof email!=='string'||!/^\S+@\S+\.\S+$/.test(email)||email.length>254)throw error(400,'正しいメールアドレスを入力してください。');
  if(typeof password!=='string'||password.length<10||password.length>256)throw error(400,'パスワードは10文字以上で入力してください。');
}
function login(db,res,user,secure){const token=makeToken();db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(tokenHash(token),user.id,now()+SESSION_AGE);setCookie(res,token,secure);json(res,200,{user:safeUser(user),stages:publicStages(progress(db,user.id))});}
function isSecure(req){return req.socket.encrypted||req.headers['x-forwarded-proto']==='https'||process.env.NODE_ENV==='production';}

export function createApp({db=openDb(),mockWeather=null}={}){
  provisionDemo(db);
  async function route(req,res){
    const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
    const path=url.pathname,method=req.method;
    try{
      if(method==='GET'&&path==='/health'){return json(res,200,{ok:true,service:'nile-quest'});}
      if(path.startsWith('/api/')){
        if(!['GET','POST'].includes(method))throw error(405,'Method not allowed');
        if(method==='POST')checkOrigin(req);
        if(method==='GET'&&path==='/api/session'){
          const user=currentUser(db,req);return json(res,200,{user:safeUser(user),stages:user?publicStages(progress(db,user.id)):null,active:user?publicRun(activeRun(db,user.id)):null});
        }
        if(method==='POST'&&path==='/api/auth/register'){
          rateLimit(req,'register:',12);
          const b=await parseJson(req);checkCredentials(b);
          const name=String(b.name||'').trim();if(name.length<2||name.length>40)throw error(400,'名前は2〜40文字で入力してください。');
          const email=b.email.trim().toLowerCase();
          if(db.prepare('SELECT id FROM users WHERE email=?').get(email))throw error(409,'このメールアドレスは登録済みです。');
          const user={id:newId(),name,email};db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(user.id,name,email,hashPassword(b.password),now());
          return login(db,res,user,isSecure(req));
        }
        if(method==='POST'&&path==='/api/auth/login'){
          rateLimit(req,'login:',30);
          const b=await parseJson(req);if(typeof b.email!=='string'||typeof b.password!=='string')throw error(400,'メールとパスワードを入力してください。');
          const user=db.prepare('SELECT * FROM users WHERE email=?').get(b.email.trim().toLowerCase());
          if(!user||!verifyPassword(b.password,user.password_hash))throw error(401,'メールアドレスまたはパスワードが違います。');
          return login(db,res,user,isSecure(req));
        }
        if(method==='POST'&&path==='/api/auth/logout'){
          const t=cookieToken(req);if(t)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(t));clearCookie(res);return json(res,200,{ok:true});
        }
        if(method==='GET'&&path==='/api/world'){
          const user=requireUser(db,req);return json(res,200,{stages:publicStages(progress(db,user.id)),active:publicRun(activeRun(db,user.id))});
        }
        if(method==='GET'&&path==='/api/leaderboard'){
          const leaders=db.prepare('SELECT u.name, SUM(p.best_score) AS score, SUM(p.completed) AS stamps FROM progress p JOIN users u ON u.id=p.user_id GROUP BY p.user_id ORDER BY stamps DESC,score DESC LIMIT 12').all();
          return json(res,200,{leaders});
        }
        if(method==='GET'&&path==='/api/weather'){
          const stageId=url.searchParams.get('stage')||'egypt';if(!stageById(stageId))throw error(404,'国が見つかりません。');
          return json(res,200,mockWeather?await mockWeather(stageId):await weather(stageId));
        }
        if(method==='POST'&&path==='/api/runs/start'){
          const user=requireUser(db,req),b=await parseJson(req),stage=stageById(b.stageId);
          if(!stage)throw error(400,'国を選んでください。');
          const p=progress(db,user.id);if(stage.order>unlockIndex(p))throw error(403,'前のステージをクリアしてください。');
          const previous=activeRun(db,user.id);
          if(previous)db.prepare("UPDATE runs SET status='finished',completed_at=? WHERE id=?").run(now(),previous.id);
          const run={id:newId(),user_id:user.id,stage_id:stage.id,started_at:now()};
          db.prepare('INSERT INTO runs (id,user_id,stage_id,question_started,started_at) VALUES(?,?,?,?,?)').run(run.id,user.id,stage.id,now(),run.started_at);
          return json(res,201,{run:publicRun(db.prepare('SELECT * FROM runs WHERE id=?').get(run.id))});
        }
        if(method==='POST'&&path==='/api/runs/next'){
          const user=requireUser(db,req),b=await parseJson(req);
          if(typeof b.runId!=='string')throw error(400,'プレイデータが正しくありません。');
          const r=db.prepare('SELECT * FROM runs WHERE id=? AND user_id=?').get(b.runId,user.id);
          if(!r||r.status!=='active'||r.question_started!==0)throw error(409,'次の問題には進めません。');
          db.prepare('UPDATE runs SET question_started=? WHERE id=?').run(now(),r.id);
          return json(res,200,{run:publicRun(db.prepare('SELECT * FROM runs WHERE id=?').get(r.id))});
        }
        if(method==='POST'&&path==='/api/runs/answer'){
          const user=requireUser(db,req),b=await parseJson(req);
          if(typeof b.runId!=='string'||typeof b.questionId!=='string'||!Number.isInteger(b.choice)||b.choice< -1||b.choice>3)throw error(400,'回答データが正しくありません。');
          // Transaction makes score writes and game progress atomic. The client never sends points.
          const payload=db.transaction?db.transaction(()=>answer(db,user,b))():transactionFallback(db,()=>answer(db,user,b));
          return json(res,200,payload);
        }
        if(method==='GET'&&path==='/api/runs/history'){
          const user=requireUser(db,req);const runs=db.prepare("SELECT * FROM runs WHERE user_id=? AND status='finished' ORDER BY completed_at DESC LIMIT 15").all(user.id).map(completedRun);return json(res,200,{runs});
        }
        throw error(404,'APIが見つかりません。');
      }
      if(method!=='GET'&&method!=='HEAD')throw error(405,'Method not allowed');
      const resource=path==='/'?'/index.html':path;
      if(resource.includes('..')||resource.includes('\\')||!/^\/[\w./-]+$/.test(resource))throw error(404,'Not found');
      const abs=normalize(join(siteDir,resource));if(!abs.startsWith(siteDir+'/'))throw error(404,'Not found');
      const content=await readFile(abs).catch(()=>null);if(!content)throw error(404,'Not found');
      headers(res,{'Content-Type':mime[extname(abs)]||'application/octet-stream','Cache-Control':abs.endsWith('index.html')?'no-cache':'public, max-age=3600'});res.writeHead(200);res.end(method==='HEAD'?undefined:content);
    }catch(e){ if(path.startsWith('/api/')||path==='/health'){const status=e.status||500;if(status===500)console.error('API error:',e);json(res,status,{error:status===500?'サーバーでエラーが発生しました。':e.message});}else{res.writeHead(e.status||404);res.end('Not found');}}
  }
  return http.createServer(route);
}
function transactionFallback(db,callback){db.exec('BEGIN IMMEDIATE');try{const result=callback();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
function answer(db,user,b){
  const r=db.prepare('SELECT * FROM runs WHERE id=? AND user_id=?').get(b.runId,user.id);
  if(!r||r.status!=='active')throw error(409,'このゲームは終了しています。');
  if(r.question_started===0)throw error(409,'次の問題を開始してください。');
  const q=getQuestion(r.stage_id,r.question_index);if(!q||q.id!==b.questionId)throw error(409,'現在の問題を確認してから回答してください。');
  const timeLeft=Math.max(0,QUIZ_LIMIT-(now()-r.question_started));
  // -1 means time expired: the server never treats it as option A.
  const correct=b.choice>=0&&timeLeft>0&&b.choice===q.correct;
  const {points,nextStreak}=scoreAnswer({correct,streak:r.streak,remainingSeconds:timeLeft/1000});
  db.prepare('INSERT INTO answers VALUES(?,?,?,?,?,?)').run(r.id,q.id,b.choice,Number(correct),points,now());
  const nextIndex=r.question_index+1,done=nextIndex>=questions[r.stage_id].length;
  const newCorrect=r.correct_count+Number(correct),newScore=r.total_score+points;
  if(!done){db.prepare('UPDATE runs SET question_index=?,correct_count=?,total_score=?,streak=?,question_started=0 WHERE id=?').run(nextIndex,newCorrect,newScore,nextStreak,r.id);}
  else {
    db.prepare("UPDATE runs SET question_index=?,correct_count=?,total_score=?,streak=?,status='finished',completed_at=? WHERE id=?").run(nextIndex,newCorrect,newScore,nextStreak,now(),r.id);
    const cleared=Number(newCorrect>=2);
    db.prepare(`INSERT INTO progress(user_id,stage_id,best_score,completed,attempts,cleared_at) VALUES(?,?,?,?,?,?)
      ON CONFLICT(user_id,stage_id) DO UPDATE SET
      best_score=MAX(progress.best_score,excluded.best_score),completed=MAX(progress.completed,excluded.completed),attempts=progress.attempts+1,
      cleared_at=CASE WHEN progress.cleared_at IS NOT NULL THEN progress.cleared_at ELSE excluded.cleared_at END`).run(user.id,r.stage_id,newScore,cleared,1,cleared?now():null);
  }
  const next=done?null:publicRun(db.prepare('SELECT * FROM runs WHERE id=?').get(r.id));
  return {correct,timedOut:b.choice===-1||timeLeft===0,points,correctIndex:q.correct,explanation:q.note,score:newScore,correctCount:newCorrect,done,cleared:done?newCorrect>=2:false,next,stages:done?publicStages(progress(db,user.id)):null};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const app=createApp();const port=Number(process.env.PORT||3000);
  app.listen(port,'0.0.0.0',()=>console.log(`NILE QUEST listening on ${port}`));
}
