import { proxyAuthActionToConvex } from "@convex-dev/auth/nextjs/server";
import { NextRequest } from "next/server";

export const POST = (request: NextRequest) => {
  return proxyAuthActionToConvex(request, {});
};