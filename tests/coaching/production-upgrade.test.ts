import {it,expect} from 'vitest';
const record=require('../../src/lib/foundations-record.cjs');
import {FOUNDATIONS_COACHING_VERSION,PREVIOUS_FOUNDATIONS_COACHING_VERSION,getReportVersion} from '../../src/lib/report-version';
it('keeps the active generation explicit and old in-flight reports legacy at cutover',()=>{
 expect(record.GENERATION).toBe(FOUNDATIONS_COACHING_VERSION);
 expect(getReportVersion(PREVIOUS_FOUNDATIONS_COACHING_VERSION,FOUNDATIONS_COACHING_VERSION)).toBe('legacy');
 expect(getReportVersion(PREVIOUS_FOUNDATIONS_COACHING_VERSION,PREVIOUS_FOUNDATIONS_COACHING_VERSION)).toBe('enhanced');
 expect(getReportVersion(FOUNDATIONS_COACHING_VERSION,FOUNDATIONS_COACHING_VERSION)).toBe('enhanced');
});

it('refreshes the document reader while preserving its node body and refuses ambiguous bundles',()=>{
 const {replaceDocumentRuntime}=require('../../scripts/coaching-foundations/production-upgrade.cjs');
 const old='var FOUNDATIONS = (() => {\n  function require_stdin(){return {}}\n  return require_stdin();\n})();\n';
 const body='return [{json:{untouched:true}}];';
 const upgraded=replaceDocumentRuntime(old+body);
 expect(upgraded.endsWith(body)).toBe(true);
 expect(upgraded).toContain('tyler-review-v2');
 expect(upgraded).toContain(record.GENERATION);
 expect(()=>replaceDocumentRuntime(old+old+body)).toThrow('anchor drift');
});
