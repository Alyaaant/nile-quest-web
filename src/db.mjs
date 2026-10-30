import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash} from 'node:crypto';

export function hashPassword(password,salt=randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password,salt,64).toString('hex')}`;
}
export function verifyPassword(password,stored) {
  if(!stored || typeof stored!=='string' || !stored.includes(':')) return false;
  const [salt,hex]=stored.split(':');
  if(!/^[0-9a-f]{32}$/.test(salt)||!/^[0-9a-f]{128}$/.test(hex))return false;
  const a=scryptSync(password,salt,64),b=Buffer.from(hex,'hex');
  return timingSafeEqual(a,b);
}
export const tokenHash = token=>createHash('sha256').update(token).digest('hex');
export const makeToken=()=>randomBytes(32).toString('base64url');
export const newId=()=>randomUUID();
export const now=()=>Date.now();

export function openDb(directory=process.env.DATA_DIR||'./data') {
  mkdirSync(directory,{recursive:true});
  const db=new DatabaseSync(join(directory,'nile-quest.sqlite'));
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stage_id TEXT NOT NULL, question_index INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0, total_score INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0, question_started INTEGER NOT NULL,
    started_at INTEGER NOT NULL, completed_at INTEGER,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','finished'))
  );
  CREATE TABLE IF NOT EXISTS answers (
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL, choice INTEGER NOT NULL, is_correct INTEGER NOT NULL,
    points INTEGER NOT NULL, answered_at INTEGER NOT NULL,
    PRIMARY KEY(run_id,question_id)
  );
  CREATE TABLE IF NOT EXISTS progress (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stage_id TEXT NOT NULL, best_score INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0,
    cleared_at INTEGER, PRIMARY KEY(user_id, stage_id)
  );
  CREATE INDEX IF NOT EXISTS idx_runs_user ON runs(user_id,started_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);`);
  return db;
}

export function provisionDemo(db, env=process.env){
  const email=env.DEMO_EMAIL?.trim().toLowerCase(),password=env.DEMO_PASSWORD;
  if(!email||!password)return false;
  if(password.length<12)throw new Error('DEMO_PASSWORD must contain at least 12 characters');
  const existing=db.prepare('SELECT id FROM users WHERE email=?').get(email);
  if(!existing){
    db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(newId(),env.DEMO_NAME||'Demo Explorer',email,hashPassword(password),now());
  } else {
    // Updating the hosting secret rotates the interviewer's credentials on restart.
    db.prepare('UPDATE users SET password_hash=?,name=? WHERE id=?').run(hashPassword(password),env.DEMO_NAME||'Demo Explorer',existing.id);
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(existing.id);
  }
  return true;
}
