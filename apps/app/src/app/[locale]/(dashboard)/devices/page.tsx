"use client";

import { useWorkspace } from "@/lib/useWorkspace";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Cpu, Trash2 } from "lucide-react";

export default function DevicesPage() {
  const { current } = useWorkspace();
  const devices = useQuery(
    api.devices.list,
    current ? { workspaceId: current } : "skip"
  );
  const createDevice = useMutation(api.devices.create);
  const removeDevice = useMutation(api.devices.remove);
  
  const [pending, setPending] = useState(false);

  const addDummyDevice = async () => {
    if (!current) return;
    setPending(true);
    try {
      const name = `Device-${Math.floor(Math.random() * 1000)}`;
      await createDevice({
        workspaceId: current,
        name,
      });
      toast.success("Device added successfully");
    } catch {
      toast.error("Couldn't add device");
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
            <h1 className="text-xl font-medium text-primary">Devices</h1>
            <p className="text-sm text-primary/60">
              Manage and connect remote devices to this workspace.
            </p>
          </div>
          <Button onClick={addDummyDevice} disabled={pending || !current}>
            {pending ? "Adding…" : "Add Device"}
          </Button>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-primary/60">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last Seen</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices === undefined && (
                <tr>
                  <td className="px-4 py-6 text-primary/40" colSpan={4}>
                    Loading…
                  </td>
                </tr>
              )}
              {devices !== undefined && devices.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-primary/40" colSpan={4}>
                    No devices yet — click “Add Device”.
                  </td>
                </tr>
              )}
              {devices?.map((device: { _id: Id<"devices">, name: string, status: string, lastSeenAt?: number }) => (
                <tr
                  key={device._id}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="px-4 py-3 font-medium flex items-center gap-2 text-primary">
                    <Cpu className="w-4 h-4 text-primary/60" />
                    {device.name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        device.status === "online" 
                          ? "bg-green-500/10 text-green-600 ring-green-600/20"
                          : "bg-red-500/10 text-red-600 ring-red-600/20"
                      }`}
                    >
                      {device.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-primary/50">
                    {device.lastSeenAt 
                      ? new Date(device.lastSeenAt).toLocaleString()
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                     <Button 
                       variant="ghost" 
                       size="icon" 
                       className="h-8 w-8 text-primary/50 hover:text-red-500"
                       onClick={() => handleRemove(device._id)}
                     >
                       <Trash2 className="h-4 w-4" />
                     </Button>
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
