import {expect,it} from 'vitest';
import {resolveRep} from '../../src/lib/script-adherence/rep-route';
it('resolves encoded names but never guesses another rep',()=>{
 const names=['Tara Reszitnyk','Alex 50%','Literal%20Name'];
 expect(resolveRep('Tara%20Reszitnyk',names)).toBe('Tara Reszitnyk');
 expect(resolveRep('Tara Reszitnyk',names)).toBe('Tara Reszitnyk');
 expect(resolveRep('Alex%2050%25',names)).toBe('Alex 50%');
 expect(resolveRep('Literal%20Name',names)).toBe('Literal%20Name');
 expect(resolveRep('Tara',names)).toBeNull();expect(resolveRep('%zz',names)).toBeNull();
});
