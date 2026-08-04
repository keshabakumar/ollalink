// @ts-nocheck
"use client";

import { useWorkspace } from "@/lib/useWorkspace";
import { api } from "@v1/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { format } from "date-fns";

export default function AnalyticsPage() {
  const { current: workspaceId } = useWorkspace();
  
  const logs = useQuery(
    api.audit.recent,
    workspaceId ? { workspaceId } : "skip"
  );

  const devices = useQuery(
    api.devices.list,
    workspaceId ? { workspaceId } : "skip"
  );
  const activeDevices = devices?.filter((d) => d.status === "online").length ?? "-";

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">
          Analytics & Logs
        </h1>
        <p className="text-sm text-primary/60">
          Monitor workspace activity and audit device events.
        </p>
      </div>

      {/* Analytics Placeholder for Recharts later */}
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-medium text-primary/60">Total Events (30d)</h3>
          <p className="mt-2 text-3xl font-bold">{logs ? logs.length : "-"}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-medium text-primary/60">Active Devices</h3>
          <p className="mt-2 text-3xl font-bold">{activeDevices}</p>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="flex-1 rounded-xl border border-border bg-card overflow-hidden flex flex-col">
        <div className="border-b border-border bg-secondary/50 px-4 py-3">
          <h2 className="text-sm font-medium">Recent Audit Logs</h2>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-secondary/90 backdrop-blur-sm">
              <tr>
                <th className="px-4 py-3 font-medium text-primary/60">Action</th>
                <th className="px-4 py-3 font-medium text-primary/60">User</th>
                <th className="px-4 py-3 font-medium text-primary/60">Details</th>
                <th className="px-4 py-3 font-medium text-primary/60 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs === undefined ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-primary/40">
                    Loading logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-primary/40">
                    No activity found in this workspace.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-secondary/20">
                    <td className="px-4 py-3 font-medium text-primary/80">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 text-primary/60">
                      {log.userId}
                    </td>
                    <td className="px-4 py-3 text-primary/60 font-mono text-xs">
                      {log.meta ? JSON.stringify(log.meta) : "—"}
                    </td>
                    <td className="px-4 py-3 text-primary/60 text-right whitespace-nowrap">
                      {format(new Date(log.at), "MMM d, yyyy HH:mm:ss")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
