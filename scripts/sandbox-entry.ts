import { readFileSync,writeFileSync } from 'node:fs';
import { validateWorld } from '../packages/fault-operators/index';
import { executePayment } from '../examples/payment-agent/index';
const check=validateWorld(JSON.parse(readFileSync('/workspace/world.json','utf8')));
if(!check.valid)throw new Error('Invalid scenario: '+check.reasons.join('; '));
writeFileSync('/workspace/observation.json',JSON.stringify(await executePayment(check.world)));

