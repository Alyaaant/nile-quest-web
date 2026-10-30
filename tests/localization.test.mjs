import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {questions,publicQuestion} from '../src/game.mjs';
import {englishQuestions} from '../src/game-en.mjs';
import {createApp} from '../src/server.mjs';
import {openDb} from '../src/db.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const dict=JSON.parse(readFileSync(new URL('../public/translations.js',import.meta.url),'utf8').split('window.NILE_TRANSLATIONS = ')[1].replace(/;\s*$/,''));

test('all 15 questions have curated English translations with matching option positions',()=>{
 const all=Object.values(questions).flat();assert.equal(all.length,15);
 for(const q of all){
  const en=englishQuestions[q.id];assert.ok(en,`missing ${q.id}`);
  assert.equal(en.options.length,4);
  assert.ok(en.prompt.length>10&&en.note.length>10);
  assert.notEqual(en.prompt,q.prompt);
  const payload=publicQuestion(q,0);
  assert.deepEqual(payload.en,en);
  assert.equal(payload.correct,undefined,'answer must not be revealed');
 }
});

test('visible UI strings have both Japanese and English translations',()=>{
 for(const [name,value] of Object.entries(dict)){
  assert.equal(typeof value.ja,'string',name+' Japanese');
  assert.equal(typeof value.en,'string',name+' English');
  assert.ok(value.ja.length>0&&value.en.length>0);
 }
 assert.ok(dict['WELCOME BACK.']);
 assert.ok(dict['まだランキング記録がありません。最初の旅人になろう！']);
});

test('API answers include an English explanation without changing the game decision',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'nile-lang-'));const db=openDb(dir);
 const app=createApp({db,mockWeather:async()=>({available:true,temperature:24})});
 await new Promise(r=>app.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${app.address().port}`;
 let cookie='';
 const request=async(path,body)=>{
  const res=await fetch(base+path,{method:body?'POST':'GET',headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];return await res.json();
 };
 try{
  await request('/api/auth/register',{name:'Bilingual Player',email:'bilingual@example.com',password:'very-long-password-123'});
  const started=await request('/api/runs/start',{stageId:'egypt'});
  assert.equal(started.run.question.en.prompt,englishQuestions.eg1.prompt);
  const result=await request('/api/runs/answer',{runId:started.run.id,questionId:'eg1',choice:1});
  assert.equal(result.correct,true);assert.equal(result.explanationEn,englishQuestions.eg1.note);
 }finally{await new Promise(r=>app.close(r));db.close();rmSync(dir,{recursive:true,force:true});}
});

test('language runtime translates navigation and dynamic labels in both directions',async()=>{
 const {runInNewContext}=await import('node:vm');
 const ui=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const snippet=ui.split('const $ = s =>')[0];
 const translations=readFileSync(new URL('../public/translations.js',import.meta.url),'utf8');
 for(const [lang,expected] of [['ja','ホーム'],['en','HOME']]){
  const context={window:{},localStorage:{getItem:key=>key==='nile-lang'?lang:'light'}};
  runInNewContext(translations,context);
  runInNewContext(snippet+'\nthis.translate=localizeString;',context);
  assert.equal(context.translate('HOME'),expected);
  assert.equal(context.translate('Italy'),lang==='ja'?'イタリア':'Italy');
  assert.equal(context.translate('QUESTION 2 OF 3'),lang==='ja'?'問題 2 / 3':'QUESTION 2 OF 3');
  assert.equal(context.translate('すべての旅は、ナイル川のほとりから。'),lang==='ja'?'すべての旅は、ナイル川のほとりから。':'Every journey begins on the banks of the Nile.');
 }
});
