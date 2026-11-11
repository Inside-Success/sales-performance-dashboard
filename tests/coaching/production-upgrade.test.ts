import {it,expect} from 'vitest';
const record=require('../../src/lib/foundations-record.cjs');
import {FOUNDATIONS_COACHING_VERSION,PREVIOUS_FOUNDATIONS_COACHING_VERSION,getReportVersion} from '../../src/lib/report-version';
it('keeps the active generation explicit and old in-flight reports legacy at cutover',()=>{
 expect(record.GENERATION).toBe(FOUNDATIONS_COACHING_VERSION);
 expect(getReportVersion(PREVIOUS_FOUNDATIONS_COACHING_VERSION,FOUNDATIONS_COACHING_VERSION)).toBe('legacy');
 expect(getReportVersion(PREVIOUS_FOUNDATIONS_COACHING_VERSION,PREVIOUS_FOUNDATIONS_COACHING_VERSION)).toBe('enhanced');
 expect(getReportVersion(FOUNDATIONS_COACHING_VERSION,FOUNDATIONS_COACHING_VERSION)).toBe('enhanced');
});
