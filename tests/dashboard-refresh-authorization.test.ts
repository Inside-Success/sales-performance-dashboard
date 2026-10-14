import { describe, expect, it, vi } from "vitest";
vi.mock('@/lib/rep-no-show',()=>({attendanceSnapshotSpec:()=>({})}));
vi.mock('@/lib/compliance-dashboard',()=>({complianceSnapshotSpec:()=>({})}));
vi.mock('@/lib/rep-scoring/v7-validation',()=>({scorecardSnapshotSpec:()=>({})}));
const refresh=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/dashboard-read-snapshot',()=>({refreshReadSnapshot:refresh}));
import { GET } from '@/app/api/admin/read-cache/refresh/route';
import { NextRequest } from 'next/server';
describe('scheduled dashboard reads',()=>{
 it('rejects unauthenticated and wrong bearer requests before any data reads',async()=>{
  vi.stubEnv('CRON_SECRET','test-only-secret');
  for(const auth of ['', 'Bearer wrong']){
   const res=await GET(new NextRequest('https://example.test/api/admin/read-cache/refresh',{headers:{authorization:auth}}));
   expect(res.status).toBe(401);
  }
  expect(refresh).not.toHaveBeenCalled(); vi.unstubAllEnvs();
 });
});
