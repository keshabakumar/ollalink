// @ts-nocheck
"use client";

import { useWorkspace } from "@/lib/useWorkspace";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Cpu, Trash2, MonitorPlay, Key } from "lucide-react";
import Link from "next/link";

export default function DevicesPage() {
  const { current } = useWorkspace();
  const devices = useQuery(
    api.devices.list,
    current ? { workspaceId: current } : "skip"
  );
  const generatePairingCode = useMutation(api.devices.generatePairingCode);
  const removeDevice = useMutation(api.devices.remove);
  
  const [pairingInfo, setPairingInfo] = useState<{ pairingCode: string } | null>(null);
  const [pending, setPending] = useState(false);

  const handleGeneratePairing = async () => {
    if (!current) return;
    setPending(true);
    try {
      const res = await generatePairingCode({ workspaceId: current });
      setPairingInfo(res);
      toast.success("Pairing code generated!");
    } catch {
      toast.error("Couldn't generate pairing code");
    } finally {
      setPending(false);
    }
  };

  const handleRemove = async (deviceId: Id<"devices">) => {
    try {
      await removeDevice({ deviceId });
      toast.success("Device removed");
    } catch {
      toast.error("Couldn't remove device");
    }
  };

  return (
    <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
      <div className="z-10 mx-auto w-full max-w-screen-xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-primary">Devices & Windows Agents</h1>
            <p className="text-sm text-primary/60">
              Manage, pair, and connect to remote Windows machines.
            </p>
          </div>
          <Button onClick={handleGeneratePairing} disabled={pending || !current} className="gap-2">
            <Key className="w-4 h-4" />
            {pending ? "Generating…" : "Pair New Agent"}
          </Button>
        </div>

        {pairingInfo && (
          <div className="mb-6 p-6 rounded-lg border border-primary/20 bg-primary/5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-primary/60">Agent Pairing Code</p>
                <p className="text-2xl font-mono font-bold tracking-widest text-primary mt-1">{pairingInfo.pairingCode}</p>
                <p className="text-xs text-primary/60 mt-1">Manual install: Enter this 6-digit code in the OllaLink Windows Agent.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setPairingInfo(null)}>Dismiss</Button>
            </div>
            
            <div className="border-t border-primary/10 pt-4">
              <p className="text-sm font-medium text-primary mb-2">Or use the One-Line Install (Recommended):</p>
              <p className="text-xs text-primary/60 mb-2">Run this in PowerShell on the remote machine. It will automatically download the agent and pair it.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-black/40 p-2 rounded text-xs font-mono text-primary/80 overflow-x-auto whitespace-nowrap scrollbar-hide">
                  Invoke-WebRequest -Uri "{typeof window !== 'undefined' ? window.location.origin : ''}/install.ps1" -OutFile "$env:TEMP\install.ps1"; powershell.exe -ExecutionPolicy Bypass -File "$env:TEMP\install.ps1" -PairingCode "{pairingInfo.pairingCode}"
                </code>
                <Button 
                  size="sm" 
                  onClick={() => {
                    navigator.clipboard.writeText(`Invoke-WebRequest -Uri "${window.location.origin}/install.ps1" -OutFile "$env:TEMP\\install.ps1"; powershell.exe -ExecutionPolicy Bypass -File "$env:TEMP\\install.ps1" -PairingCode "${pairingInfo.pairingCode}"`);
                    toast.success("Command copied to clipboard!");
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-primary/60">
              <tr>
                <th className="px-4 py-3 font-medium">Device Name</th>
                <th className="px-4 py-3 font-medium">OS / IP</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">System</th>
                <th className="px-4 py-3 font-medium">Last Seen</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices === undefined && (
                <tr>
                  <td className="px-4 py-6 text-primary/40" colSpan={6}>
                    Loading devices…
                  </td>
                </tr>
              )}
              {devices !== undefined && devices.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-primary/40" colSpan={6}>
                    No devices paired yet — click “Pair New Agent” to link a Windows machine.
                  </td>
                </tr>
              )}
              {devices?.map((device) => (
                <tr
                  key={device._id}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-medium flex items-center gap-2 text-primary">
                    <Cpu className="w-4 h-4 text-primary/60" />
                    {device.name}
                  </td>
                  <td className="px-4 py-3 text-primary/60">
                    {device.os || "Windows 11"} {device.ipAddress ? `(${device.ipAddress})` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        device.status === "online" 
                          ? "bg-green-500/10 text-green-600 ring-green-600/20"
                          : device.status === "pairing"
                          ? "bg-yellow-500/10 text-yellow-600 ring-yellow-600/20"
                          : "bg-red-500/10 text-red-600 ring-red-600/20"
                      }`}
                    >
                      {device.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-primary/60">
                    {device.status === "online" ? (
                      <div className="flex flex-col gap-1">
                        {device.cpuUsage != null && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-8">CPU</span>
                            <div className="h-1.5 w-16 rounded-full bg-primary/10 overflow-hidden">
                              <div className="h-full bg-blue-500" style={{ width: `${Math.min(device.cpuUsage, 100)}%` }} />
                            </div>
                            <span>{device.cpuUsage}%</span>
                          </div>
                        )}
                        {device.memUsage != null && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-8">RAM</span>
                            <div className="h-1.5 w-16 rounded-full bg-primary/10 overflow-hidden">
                              <div className="h-full bg-green-500" style={{ width: `${Math.min(device.memUsage, 100)}%` }} />
                            </div>
                            <span>{device.memUsage}%</span>
                          </div>
                        )}
                        {device.uptime != null && (
                          <span className="text-primary/40">
                            up {device.uptime < 3600 ? `${Math.floor(device.uptime / 60)}m` : `${Math.floor(device.uptime / 3600)}h ${Math.floor((device.uptime % 3600) / 60)}m`}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-primary/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-primary/50">
                    {device.lastSeenAt 
                      ? new Date(device.lastSeenAt).toLocaleString()
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {device.status === "online" && (
                        <Link href={`/devices/${device._id}`}>
                          <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                            <MonitorPlay className="w-3.5 h-3.5" />
                            Connect
                          </Button>
                        </Link>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-primary/50 hover:text-red-500"
                        onClick={() => handleRemove(device._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
