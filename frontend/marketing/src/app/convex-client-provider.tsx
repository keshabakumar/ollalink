"use client";

import { env } from "@/env";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

// Lazy-init so the build doesn't crash when NEXT_PUBLIC_CONVEX_URL is unset
// (the marketing site is static and doesn't issue Convex queries at build).
let convex: ConvexReactClient | null = null;
function getClient() {
  if (!convex && env.NEXT_PUBLIC_CONVEX_URL) {
    convex = new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL, { verbose: true });
  }
  return convex;
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const client = getClient();
  return client ? <ConvexProvider client={client}>{children}</ConvexProvider> : <>{children}</>;
}
