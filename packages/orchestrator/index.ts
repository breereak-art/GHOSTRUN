import { randomUUID } from 'node:crypto';
import { campaignSchema,fingerprint,type CampaignConfig,type Category,type World,type Run } from '../core/index';
import { generate,mutate,priority,behavior,prune,withFaults } from '../elsewhere/index';
import { operator } from '../fault-operators/index';
import { runExperiment,localBackend,type Backend } from '../counterfactual/index';

export interface Candidate { world:World; status:'queued'|'running'|'completed'|'pruned';reason:string;runId?:string;novelty:number }
export interface Counterexample { id:string;originalScenarioId:string;minimizedScenarioId:string;violationIds:string[];runIds:string[];reproduced:number;attempted:number;status:'confirmed'|'unconfirmed'|'unstable';minimality:string;regressionRunId?:string }
export interface Campaign { id:string;createdAt:string;updatedAt:string;config:CampaignConfig;status:'queued'|'running'|'completed'|'interrupted'|'error';candidates:Candidate[];runs:Run[];counterexamples:Counterexample[];log:{at:string;message:string}[];coverage:{categories:Record<string,number>;transitions:string[];combinations:string[]};planner:{mode:string;model?:string;accepted:number;rejected:string[]};error?:string }
export function newCampaign(input:unknown):Campaign {
 const config=campaignSchema.parse(input);return {id:randomUUID(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),config,status:'queued',candidates:[],runs:[],counterexamples:[],log:[],coverage:{categories:{},transitions:[],combinations:[]},planner:{mode:config.planner,accepted:0,rejected:[]}};
}
const signature=(r:Run)=>r.invariants.filter(i=>i.verdict==='VIOLATION').map(i=>i.id).sort();
const sameViolation=(r:Run,ids:string[])=>r.verdict==='VIOLATION'&&ids.every(id=>new Set<string>(signature(r)).has(id));
export async function executeCampaign(c:Campaign,backend:Backend=localBackend,save:(c:Campaign)=>void=()=>{},planned:World[]=[]):Promise<Campaign>{
 const seen=new Set<string>(),tested=new Map<Category,number>(),behaviors=new Set<string>();
 const log=(message:string)=>{c.log.push({at:new Date().toISOString(),message});c.updatedAt=new Date().toISOString();save(c);};
 const enqueue=(w:World,novelty=1)=>{
   const why=prune(w,seen);if(!why)seen.add(fingerprint(w));
   c.candidates.push({world:w,status:why?'pruned':'queued',reason:why??w.metadata.reason,novelty});
 };
 const remaining=()=>c.config.budget-c.runs.length;
 async function execute(w:World,purpose:Run['purpose']){
   let candidate=c.candidates.find(x=>x.world.id===w.id&&x.status!=='pruned');
   if(!candidate){candidate={world:w,status:'queued',reason:purpose,novelty:1};c.candidates.push(candidate);}
   candidate.status='running';log(purpose+': '+w.id);
   const run=await runExperiment(w,backend,purpose);c.runs.push(run);candidate.runId=run.id;candidate.status='completed';
   if(run.observation){
     for(const f of w.faults.filter(f=>run.observation!.appliedFaults.includes(f.operator))){const cat=operator(f.operator).category;tested.set(cat,(tested.get(cat)??0)+1);c.coverage.categories[cat]=(c.coverage.categories[cat]??0)+1;}
     for(const r of run.observation.records){const t='started → '+r.status;if(!c.coverage.transitions.includes(t))c.coverage.transitions.push(t);}
     const combination=run.observation.appliedFaults.slice().sort().join(' + ')||'baseline';
     if(!c.coverage.combinations.includes(combination))c.coverage.combinations.push(combination);
   }
   log(run.verdict+' · '+purpose);return run;
 }
 c.status='running';log('Campaign started. Budget includes discovery, replay, minimization and regression.');
 generate(c.config.agentVersion,c.config.seed,c.config.categories).forEach(w=>enqueue(w));planned.forEach(w=>enqueue(w,1.5));
 try{
 while(remaining()>0){
   const queued=c.candidates.filter(x=>x.status==='queued');if(!queued.length)break;
   queued.sort((a,b)=>priority(b.world,tested,b.novelty).score-priority(a.world,tested,a.novelty).score||a.world.id.localeCompare(b.world.id));
   const candidate=c.runs.length===0?queued.find(x=>x.world.faults.length===0)??queued[0]:queued[0];
   candidate.reason=priority(candidate.world,tested,candidate.novelty).reason;
   const run=await execute(candidate.world,'discovery');
   const key=behavior(run),isNovel=!behaviors.has(key);behaviors.add(key);
   if(run.verdict==='INFRA_ERROR'){c.status='error';c.error=run.error;log('Backend unavailable; campaign stopped without local fallback.');break;}
   if(run.verdict==='VIOLATION'){
     const ids=signature(run);
     const ce:Counterexample={id:randomUUID(),originalScenarioId:candidate.world.id,minimizedScenarioId:candidate.world.id,violationIds:ids,runIds:[run.id],reproduced:1,attempted:1,status:'unconfirmed',minimality:'Not minimized; confirmation pending'};
     c.counterexamples.push(ce);
     for(let i=0;i<2&&remaining()>0;i++){const replay=await execute(candidate.world,'replay');ce.runIds.push(replay.id);ce.attempted++;if(sameViolation(replay,ids))ce.reproduced++;}
     ce.status=ce.attempted===3&&ce.reproduced===3?'confirmed':ce.reproduced<ce.attempted?'unstable':'unconfirmed';
     if(ce.status==='confirmed'){
       let smallest=candidate.world;
       // Greedy bounded delta reduction. Every accepted deletion is executed.
       for(let i=0;i<smallest.faults.length&&remaining()>1;){
         const reduced=withFaults(smallest,smallest.faults.filter((_,j)=>j!==i),'minimization');
         const result=await execute(reduced,'minimize');
         if(sameViolation(result,ids)){smallest=reduced;ce.runIds.push(result.id);}else i++;
       }
       if(smallest.initialState.amount>1&&remaining()>1){
         const reduced=structuredClone(smallest);reduced.parentId=smallest.id;reduced.initialState.amount=1;reduced.metadata={...smallest.metadata,source:'minimization',reason:'Reduce synthetic amount to smallest positive boundary'};reduced.id=fingerprint(reduced);
         const result=await execute(reduced,'minimize');if(sameViolation(result,ids)){smallest=reduced;ce.runIds.push(result.id);}
       }
       // Recheck the reduced world before describing it as reproducible.
       if(smallest.id!==candidate.world.id&&remaining()>1){
         const replay=await execute(smallest,'replay');
         if(sameViolation(replay,ids)){ce.minimizedScenarioId=smallest.id;ce.runIds.push(replay.id);}else smallest=candidate.world;
       }else smallest=candidate.world;
       ce.minimality='Smallest reproduced world found by bounded greedy reduction; no global minimality claim.';
       if(remaining()>0){
         const hardened=structuredClone(smallest);hardened.agentVersion='payment-hardened@1';hardened.parentId=smallest.id;hardened.id=fingerprint(hardened);
         const regression=await execute(hardened,'regression');ce.regressionRunId=regression.id;
       }
     }
     log(ce.status+': '+ids.join(', '));
   }
   if(isNovel||run.verdict==='VIOLATION')mutate(candidate.world,run,c.config.categories,c.config.depth).forEach(w=>enqueue(w,isNovel?1.5:1));
 }
 if(c.status==='running')c.status='completed';
 log('Campaign '+c.status+'. '+c.runs.length+'/'+c.config.budget+' executions used.');
 }catch(e){c.status='error';c.error=e instanceof Error?e.message:'Campaign error';log('Campaign interrupted by internal error.');}
 save(c);return c;
}


