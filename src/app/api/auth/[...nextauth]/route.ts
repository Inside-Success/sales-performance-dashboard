import { handleAuthRequest } from "@/auth";

export const runtime = "nodejs";

export const GET = handleAuthRequest;
export const POST = handleAuthRequest;
