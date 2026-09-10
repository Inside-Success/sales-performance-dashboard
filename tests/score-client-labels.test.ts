import { afterEach, expect, it, vi } from 'vitest';
const { query } = vi.hoisted(() => ({query: vi.fn()}));
vi.mock('@neondatabase/serverless', () => ({neon: () => ({query})}));
import { getScoreClientLabels } from '@/lib/rep-scoring/client-labels';
afterEach(() => { vi.unstubAllEnvs(); query.mockReset(); });
it('uses exact source IDs and rejects ambiguous names in the read query', async () => {
 vi.stubEnv('DATABASE_URL','test'); query.mockResolvedValue([{source_id:'rec1',client_name:'Client'}]);
 expect(await getScoreClientLabels(['rec1','rec1'])).toEqual({rec1:'Client'});
 expect(query.mock.calls[0][1]).toEqual([['rec1']]);
 expect(query.mock.calls[0][0]).toContain('having count(distinct trim(client_name)) = 1');
});
it('keeps scores available when optional labels cannot be read', async () => {
 vi.stubEnv('DATABASE_URL','test'); query.mockRejectedValue(new Error('offline'));
 expect(await getScoreClientLabels(['rec1'])).toEqual({});
});
it('does not query for an empty call list', async () => {
 expect(await getScoreClientLabels([])).toEqual({}); expect(query).not.toHaveBeenCalled();
});
