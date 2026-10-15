import { createHash } from 'node:crypto';
import { canonical } from '../core/index';
import type { Campaign,Counterexample } from '../orchestrator/index';
export function exportEvidence(c:Campaign,ce:Counterexample){
 const world=c.candidates.find(x=>x.world.id===ce.minimizedScenarioId)!.world;
 const payload={schemaVersion:1,createdAt:new Date().toISOString(),campaignId:c.id,config:c.config,counterexample:ce,world,runs:c.runs.filter(r=>ce.runIds.includes(r.id)||r.id===ce.regressionRunId),limitations:['Synthetic banking semantics only.','Trusted-local is not a security boundary.','Reproduction frequency is descriptive, not a statistical confidence estimate.','Bounded reduction does not prove global minimality.']};
 return {...payload,sha256:createHash('sha256').update(canonical(payload)).digest('hex')};
}
export function exportRegression(c:Campaign,ce:Counterexample){
 return {schemaVersion:1,kind:'ghostrun-regression',world:c.candidates.find(x=>x.world.id===ce.minimizedScenarioId)!.world,expectedViolationIds:ce.violationIds,backend:c.config.backend,command:'npm run replay -- path/to/regression.json',hardenedCommand:'npm run replay -- path/to/regression.json --hardened'};
}

