import { it,expect } from 'vitest';
import { newCampaign,executeCampaign } from '../../packages/orchestrator/index';
import { localBackend } from '../../packages/counterfactual/index';
import { Store } from '../../packages/scenario-store/index';
import { exportEvidence,exportRegression } from '../../packages/evidence/index';
import { categories } from '../../packages/core/index';
it('runs budgeted campaigns, persists real evidence, reproduces and exports regression',async()=>{
 const store=new Store(':memory:');
 const c=newCampaign({agentVersion:'payment-vulnerable@1',categories:[...categories],budget:30,depth:2,seed:7,backend:'trusted-local'});
 await executeCampaign(c,localBackend,x=>store.save(x));
 expect(c.status).toBe('completed');expect(c.runs.length).toBeLessThanOrEqual(30);
 const confirmed=c.counterexamples.filter(x=>x.status==='confirmed');expect(confirmed.length).toBeGreaterThan(0);
 const ce=confirmed[0];expect(ce.reproduced).toBe(3);expect(c.runs.find(r=>r.id===ce.regressionRunId)?.verdict).toBe('PASS');
 expect(exportEvidence(c,ce).runs.length).toBeGreaterThan(2);expect(exportEvidence(c,ce).sha256).toHaveLength(64);
 expect(exportRegression(c,ce).world).toBeDefined();expect(store.get(c.id)?.runs).toHaveLength(c.runs.length);store.close();
});
it('respects one-run budget and never invents confirmation',async()=>{
 const c=newCampaign({agentVersion:'payment-vulnerable@1',categories:['network'],budget:1,depth:2,seed:7,backend:'trusted-local'});
 await executeCampaign(c);expect(c.runs).toHaveLength(1);expect(c.runs[0].verdict).toBe('PASS');expect(c.counterexamples).toHaveLength(0);
});
it('stops on unavailable backend without local fallback',async()=>{
 const c=newCampaign({agentVersion:'payment-vulnerable@1',categories:['network'],budget:20,depth:2,seed:7,backend:'createos'});
 await executeCampaign(c,{name:'createos',execute:async()=>{throw new Error('unconfigured');}});
 expect(c.status).toBe('error');expect(c.runs).toHaveLength(1);expect(c.runs[0].backend).toBe('createos');
});
it('recovers interrupted campaigns without claiming completion',()=>{
 const s=new Store(':memory:');const c=newCampaign({agentVersion:'payment-vulnerable@1',categories:['network'],budget:1,depth:0,seed:0,backend:'trusted-local'});s.save(c);s.recover();expect(s.get(c.id)?.status).toBe('interrupted');s.close();
});

