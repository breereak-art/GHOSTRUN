import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Campaign } from '../orchestrator/index';
export class Store {
 db:DatabaseSync;
 constructor(path=process.env.GHOSTRUN_DB??'data/ghostrun.sqlite'){
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
  this.db=new DatabaseSync(path);
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
   CREATE TABLE IF NOT EXISTS campaigns(id TEXT PRIMARY KEY,updated_at TEXT NOT NULL,body TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS scenarios(id TEXT NOT NULL,campaign_id TEXT NOT NULL REFERENCES campaigns(id),body TEXT NOT NULL,PRIMARY KEY(id,campaign_id));
   CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES campaigns(id),scenario_id TEXT NOT NULL,body TEXT NOT NULL,FOREIGN KEY(scenario_id,campaign_id) REFERENCES scenarios(id,campaign_id));
   CREATE TABLE IF NOT EXISTS counterexamples(id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES campaigns(id),body TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS run_campaign ON runs(campaign_id);`);
 }
 save(c:Campaign){
  this.db.exec('BEGIN IMMEDIATE');
  try{
   this.db.prepare('INSERT INTO campaigns VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at,body=excluded.body').run(c.id,c.updatedAt,JSON.stringify(c));
   const s=this.db.prepare('INSERT INTO scenarios VALUES(?,?,?) ON CONFLICT(id,campaign_id) DO UPDATE SET body=excluded.body');
   for(const x of c.candidates)s.run(x.world.id,c.id,JSON.stringify(x.world));
   const r=this.db.prepare('INSERT INTO runs VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body');
   for(const x of c.runs)r.run(x.id,c.id,x.scenarioId,JSON.stringify(x));
   const e=this.db.prepare('INSERT INTO counterexamples VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body');
   for(const x of c.counterexamples)e.run(x.id,c.id,JSON.stringify(x));
   this.db.exec('COMMIT');
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 list():Campaign[]{return this.db.prepare('SELECT body FROM campaigns ORDER BY updated_at DESC LIMIT 100').all().map(r=>JSON.parse(String(r.body)) as Campaign);}
 get(id:string):Campaign|undefined{const r=this.db.prepare('SELECT body FROM campaigns WHERE id=?').get(id);return r?JSON.parse(String(r.body)):undefined;}
 recover(){for(const c of this.list())if(c.status==='running'||c.status==='queued'){c.status='interrupted';c.error='Server restarted; in-flight work was not presumed complete.';this.save(c);}}
 close(){this.db.close();}
}

