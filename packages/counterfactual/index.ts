import { randomUUID } from 'node:crypto';
import { adapters } from '../../examples/payment-agent/index';
import { validateWorld } from '../fault-operators/index';
import { verify } from '../invariant-checker/index';
import type { Observation, Run, World } from '../core/index';

export interface Backend { name:Run['backend']; execute(world:World):Promise<{observation:Observation;environment:Record<string,unknown>}> }
export const localBackend:Backend={
 name:'trusted-local',
 async execute(world){
   // Closed registry, no imports/commands/paths from scenario input.
   const adapter=adapters[world.agentVersion];
   if(!adapter)throw new Error('UNTRUSTED_TARGET_REJECTED');
   return {observation:await adapter.run(world),environment:{fixtureVersion:'1',runtime:process.version,isolation:'none; trusted bundled fixtures only'}};
 }
};
export async function runExperiment(input:unknown,backend:Backend=localBackend,purpose:Run['purpose']='discovery'):Promise<Run>{
 const start=Date.now();const checked=validateWorld(input);
 const w=checked.valid?checked.world:undefined;
 const base={id:randomUUID(),scenarioId:w?.id??'invalid',agentVersion:w?.agentVersion??'payment-vulnerable@1' as const,backend:backend.name,startedAt:new Date().toISOString(),purpose,environment:{}};
 if(!checked.valid)return {...base,durationMs:Date.now()-start,verdict:'INVALID',invariants:[],error:checked.reasons.join('; ')};
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
   // Cloud backend owns its deadline and cleanup; local deadline guards only
   // cooperative fixtures and is explicitly not a hostile-code boundary.
   const result=backend.name==='createos'?await backend.execute(checked.world):await Promise.race([
     backend.execute(checked.world),
     new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('EXECUTION_TIMEOUT')),checked.world.budget.timeoutMs);})
   ]);
   const invariants=verify(checked.world,result.observation);
   const unapplied=checked.world.faults.filter(f=>!result.observation.appliedFaults.includes(f.operator));
   const violation=invariants.some(i=>i.verdict==='VIOLATION');
   const verdict=violation?'VIOLATION':!result.observation.completed||unapplied.length?'INCONCLUSIVE':'PASS';
   return {...base,...result,durationMs:Date.now()-start,verdict,invariants,error:unapplied.length?'Unreached injection points: '+unapplied.map(f=>f.operator).join(', '):undefined};
 }catch(e){
   return {...base,durationMs:Date.now()-start,verdict:'INFRA_ERROR',invariants:[],error:e instanceof Error?e.message:'Backend failed'};
 }finally{if(timer)clearTimeout(timer);}
}

