"use client";

import { useWorkspace } from "@/lib/useWorkspace";
import { api } from "@v1/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Monitor, X, ChevronUp, Copy, Check } from "lucide-react";

export default function DevicesPage() {
  const { current } = useWorkspace();
  const devices = useQuery(
    api.devices.list,
    current ? { workspaceId: current } : "skip"
  );
  const generatePairingCode = useMutation(api.devices.generatePairingCode);
  
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);

  // Form states
  const [deviceId, setDeviceId] = useState("");
  const [accessCode, setAccessCode] = useState("");

  const handleCopy = () => {
    navigator.clipboard.writeText("wss://signaling.ollalink.com");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateCommand = async () => {
    if (!current) return;
    setPending(true);
    try {
      const res = await generatePairingCode({ workspaceId: current });
      const command = `Invoke-WebRequest -Uri "https://ollalink.com/install.ps1" -OutFile "$env:TEMP\\install.ps1"; & "$env:TEMP\\install.ps1" -PairingCode "${res.pairingCode}"`;
      await navigator.clipboard.writeText(command);
      toast.success("Install command copied to clipboard!");
    } catch {
      toast.error("Couldn't generate command");
    } finally {
      setPending(false);
    }
  };

  const handleClaim = (e: React.FormEvent) => {
    e.preventDefault();
    toast.info("Claiming device feature in development...");
  };

  return (
    <div className="flex h-full w-full bg-[#0a0a0a] text-white px-6 py-8 font-sans">
      <div className="mx-auto w-full max-w-5xl flex flex-col gap-6">
        
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Devices</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Remote machines in this workspace.
            </p>
          </div>
          <button 
            onClick={() => setIsAddDeviceOpen(true)}
            className="bg-[#10b981] hover:bg-[#059669] text-black font-medium text-sm px-4 py-2 rounded-full transition-colors flex items-center gap-1"
          >
            + Add device
          </button>
        </div>

        {/* Connect Banner */}
        <div className="flex items-center gap-3 p-4 rounded-lg border border-[#10b981]/20 bg-[#062114]">
          <Monitor className="w-5 h-5 text-blue-400 shrink-0" />
          <p className="text-sm text-zinc-300">
            <span className="font-semibold text-white">Connect from your browser.</span> Click <span className="font-semibold text-white">Connect</span> on any online machine to control it right here — no software to install on this device. Only the target machine runs the ollalink agent.
          </p>
        </div>

        {/* Devices List (Empty State) */}
        <div className="bg-[#111214] border border-zinc-800/50 rounded-xl min-h-[160px] flex items-center justify-center">
          <div className="text-center">
            <p className="text-zinc-400 text-sm">No devices yet.</p>
            <p className="text-zinc-500 text-sm mt-1">Install the ollalink agent on a machine and claim it here to start connecting from your browser.</p>
          </div>
        </div>

        {/* Add a device Panel */}
        {isAddDeviceOpen && (
          <div className="bg-[#111214] border border-zinc-800/50 rounded-xl p-6 relative flex flex-col gap-6">
            <button 
              onClick={() => setIsAddDeviceOpen(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            
            <h2 className="text-lg font-semibold">Add a device</h2>

            {/* Recommended Section */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="bg-[#10b981]/20 text-[#10b981] text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-sm">
                  Recommended
                </span>
                <span className="text-sm font-medium">One-line install (Windows)</span>
              </div>
              <p className="text-xs text-zinc-400">
                Generate a command, run it in PowerShell on the machine you want to control — it installs the agent and adds it to this workspace automatically.
              </p>
              <div>
                <button 
                  onClick={handleGenerateCommand}
                  disabled={pending}
                  className="bg-[#10b981] hover:bg-[#059669] text-black font-medium text-sm px-4 py-2 rounded-lg transition-colors"
                >
                  {pending ? "Generating..." : "Generate install command"}
                </button>
              </div>
            </div>

            {/* Manual setup Section */}
            <div className="mt-2 border-t border-zinc-800/50 pt-6">
              <div className="flex items-center justify-between cursor-pointer group mb-6">
                <span className="text-sm text-zinc-300">Manual setup & macOS</span>
                <ChevronUp className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Column 1 */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-sm font-semibold">1 - Download</h3>
                  <div className="flex flex-col gap-2">
                    <button className="w-full bg-[#1c1d21] border border-zinc-800 text-zinc-300 text-xs text-left px-3 py-2.5 rounded hover:bg-zinc-800 transition-colors">
                      Windows x64 — branded (.exe)
                    </button>
                    <button className="w-full bg-[#1c1d21]/50 border border-zinc-800/50 text-zinc-500 text-xs text-left px-3 py-2.5 rounded cursor-not-allowed">
                      macOS — coming soon
                    </button>
                  </div>
                </div>

                {/* Column 2 */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-sm font-semibold">2 - Point at ollalink</h3>
                  <p className="text-xs text-zinc-400">
                    In the agent {'->'} Settings {'->'} Network, set the signaling server:
                  </p>
                  <div className="flex bg-[#1c1d21] border border-zinc-800 rounded overflow-hidden">
                    <input 
                      type="text" 
                      readOnly 
                      value="wss://signaling.ollalink.com"
                      className="bg-transparent border-none text-xs text-zinc-300 px-3 py-2.5 w-full outline-none"
                    />
                    <button 
                      onClick={handleCopy}
                      className="px-3 py-2.5 border-l border-zinc-800 hover:bg-zinc-800 text-zinc-400 text-xs transition-colors flex items-center gap-1"
                    >
                      {copied ? <Check className="w-3 h-3 text-[#10b981]" /> : null}
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    Then note the Device ID + Access Code it shows.
                  </p>
                </div>

                {/* Column 3 */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-sm font-semibold">3 - Claim it</h3>
                  <form onSubmit={handleClaim} className="flex flex-col gap-2">
                    <input 
                      type="text" 
                      placeholder="Device ID"
                      value={deviceId}
                      onChange={(e) => setDeviceId(e.target.value)}
                      className="w-full bg-[#1c1d21] border border-zinc-800 text-zinc-300 text-xs px-3 py-2.5 rounded outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600"
                    />
                    <input 
                      type="text" 
                      placeholder="Access code"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      className="w-full bg-[#1c1d21] border border-zinc-800 text-zinc-300 text-xs px-3 py-2.5 rounded outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600"
                    />
                    <button 
                      type="submit"
                      disabled={!deviceId || !accessCode}
                      className="w-full bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium text-sm px-4 py-2.5 rounded transition-colors mt-2"
                    >
                      Claim device
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
