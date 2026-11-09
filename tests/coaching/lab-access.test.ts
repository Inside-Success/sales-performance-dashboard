import { describe, it, expect } from 'vitest';
import { canReadCoachingLab } from '../../src/lib/coaching-lab-access';
describe('isolated coaching preview access',()=>{
 it('requires owner and preview together',()=>{
  expect(canReadCoachingLab('preview','syed.haider@insidesuccess.com')).toBe(true);
  for(const env of ['production','development',undefined]) expect(canReadCoachingLab(env,'syed.haider@insidesuccess.com')).toBe(false);
  for(const email of [null,undefined,'rep@insidesuccess.com','syed.haider@insidesuccess.com.attacker.test']) expect(canReadCoachingLab('preview',email)).toBe(false);
 });
});
