import {afterEach,expect,it,vi} from 'vitest';
const {auth,query}=vi.hoisted(()=>({auth:vi.fn(),query:vi.fn()}));
vi.mock('@/auth',()=>({auth}));
vi.mock('@neondatabase/serverless',()=>({neon:()=>query}));
import{GET}from'../../src/app/api/coaching-lab/storage-check/route';
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
it('does not expose diagnostics in production',async()=>{vi.stubEnv('VERCEL_ENV','production');vi.stubEnv('COACHING_LAB_CONNECTED','true');expect((await GET()).status).toBe(404);expect(auth).not.toHaveBeenCalled();expect(query).not.toHaveBeenCalled();});
it('does not inspect storage for another signed-in user',async()=>{vi.stubEnv('VERCEL_ENV','preview');vi.stubEnv('COACHING_LAB_CONNECTED','true');auth.mockResolvedValue({user:{email:'another@insidesuccess.com'}});expect((await GET()).status).toBe(403);expect(query).not.toHaveBeenCalled();});
it('returns identity hashes without credentials to the lab owner',async()=>{vi.stubEnv('VERCEL_ENV','preview');vi.stubEnv('COACHING_LAB_CONNECTED','true');vi.stubEnv('COACHING_LAB_DATABASE_URL','postgres://user:privatepassword@example.invalid/lab');auth.mockResolvedValue({user:{email:'syed.haider@insidesuccess.com'}});query.mockResolvedValue([{database:'lab'}]);const r=await GET(),text=await r.text();expect(r.status).toBe(200);expect(text).not.toContain('privatepassword');expect(text).not.toContain('example.invalid');expect(JSON.parse(text).connectionFingerprint).toMatch(/^[a-f0-9]{64}$/);expect(r.headers.get('cache-control')).toBe('no-store');});

it('connected previews fail closed instead of using inherited database settings',async()=>{const {databaseUrl}=await import('../../src/lib/database-connection');expect(()=>databaseUrl({VERCEL_ENV:'preview',COACHING_LAB_CONNECTED:'true',DATABASE_URL:'inherited'})).toThrow('Explicit coaching lab');expect(databaseUrl({VERCEL_ENV:'production',COACHING_LAB_CONNECTED:'true',DATABASE_URL:'production'})).toBe('production');expect(databaseUrl({VERCEL_ENV:'preview',COACHING_LAB_CONNECTED:'true',DATABASE_URL:'injected-clone',COACHING_LAB_DATABASE_URL:'authorized-lab'})).toBe('authorized-lab');});
