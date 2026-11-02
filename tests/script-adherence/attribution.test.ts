import {expect,it} from 'vitest';
import {observedRep} from '@/lib/script-adherence/attribution';
it('corrects a different recording host only with explicit roster and live role evidence',()=>{
 const t="[00:01] Alexis McAllister: My name is Alexis, I am one of the casting managers here.\n[00:02] Alexis McAllister: Tell me about your business.\n[00:03] Alexis McAllister: What made you apply?";
 expect(observedRep(t,'Bryce Sheldon',['Alexis McAllister','Bryce Sheldon']).rep).toBe('Alexis McAllister');
 expect(observedRep(t,'Bryce Sheldon',['Bryce Sheldon']).rep).toBe('Bryce Sheldon');
});
it('does not treat a named prospect or informal alias as a rep reassignment',()=>{
 const t='[00:01] Alexis McAllister: I own a business.\n[00:02] Alexis McAllister: Yes.\n[00:03] Alexis McAllister: Great.';
 expect(observedRep(t,'Bryce Sheldon',['Alexis McAllister']).rep).toBe('Bryce Sheldon');
});
