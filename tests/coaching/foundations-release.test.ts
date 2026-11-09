import {it,expect} from 'vitest';
const {build}=require('../../scripts/coaching-foundations/n8n-workflow.cjs');
it('requires explicit production binding and preserves the tested graph',()=>{
 expect(()=>build({providerWorkflowId:'X9L4JtDbpkSCflxZ',models:{}})).toThrow('isolated');
 expect(()=>build({providerWorkflowId:'other',models:{},deployment:'production'})).toThrow('governed');
 const isolated=build({providerWorkflowId:'isolated-provider',models:{}}),prod=build({providerWorkflowId:'X9L4JtDbpkSCflxZ',models:{},deployment:'production'});
 const child=isolated.nodes.find((n:any)=>n.name==='Provider');child.parameters.workflowId.value='X9L4JtDbpkSCflxZ';
 expect(prod.nodes).toEqual(isolated.nodes);expect(prod.connections).toEqual(isolated.connections);expect(prod.settings).toEqual(isolated.settings);
});
