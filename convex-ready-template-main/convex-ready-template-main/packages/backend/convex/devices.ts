import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMember } from "./orgs";

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    await requireMember(ctx, userId, workspaceId);
    return ctx.db
      .query("devices")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
  },
  handler: async (ctx, { workspaceId, name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requireMember(ctx, userId, workspaceId);

    const deviceId = await ctx.db.insert("devices", {
      workspaceId,
      name,
      status: "offline",
      createdAt: Date.now(),
    });
    return deviceId;
  },
});

export const updateStatus = mutation({
  args: {
    deviceId: v.id("devices"),
    status: v.string(),
  },
  handler: async (ctx, { deviceId, status }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const device = await ctx.db.get(deviceId);
    if (!device) throw new Error("Device not found");
    
    await requireMember(ctx, userId, device.workspaceId);

    await ctx.db.patch(deviceId, {
      status,
      lastSeenAt: status === "online" ? Date.now() : device.lastSeenAt,
    });
  },
});

export const get = query({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, { deviceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const device = await ctx.db.get(deviceId);
    if (!device) return null;
    await requireMember(ctx, userId, device.workspaceId);
    return device;
  },
});

export const generatePairingCode = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requireMember(ctx, userId, workspaceId);

    const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
    const deviceId = await ctx.db.insert("devices", {
      workspaceId,
      name: `Pending Agent (${pairingCode})`,
      status: "pairing",
      pairingCode,
      createdAt: Date.now(),
    });

    return { deviceId, pairingCode };
  },
});

export const pairAgent = mutation({
  args: {
    pairingCode: v.string(),
    hostname: v.string(),
    os: v.string(),
    ipAddress: v.optional(v.string()),
    agentVersion: v.optional(v.string()),
  },
  handler: async (ctx, { pairingCode, hostname, os, ipAddress, agentVersion }) => {
    const device = await ctx.db
      .query("devices")
      .withIndex("by_pairing_code", (q) => q.eq("pairingCode", pairingCode))
      .first();

    if (!device) throw new Error("Invalid or expired pairing code");

    const deviceToken = `dev_tok_${Math.random().toString(36).substring(2)}_${Date.now()}`;

    await ctx.db.patch(device._id, {
      name: hostname || device.name,
      status: "online",
      hostname,
      os,
      ipAddress,
      agentVersion,
      pairingCode: undefined, // Clear code once used
      deviceToken,
      lastSeenAt: Date.now(),
    });

    return { deviceId: device._id, deviceToken, workspaceId: device.workspaceId };
  },
});

export const agentHeartbeat = mutation({
  args: {
    deviceToken: v.string(),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, { deviceToken, ipAddress }) => {
    const device = await ctx.db
      .query("devices")
      .withIndex("by_device_token", (q) => q.eq("deviceToken", deviceToken))
      .first();

    if (!device) throw new Error("Invalid device token");

    await ctx.db.patch(device._id, {
      status: "online",
      lastSeenAt: Date.now(),
      ...(ipAddress ? { ipAddress } : {}),
    });

    // Check if there is an active session pending for this device
    const activeSession = await ctx.db
      .query("deviceSessions")
      .withIndex("by_device", (q) => q.eq("deviceId", device._id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    return {
      status: "ok",
      activeSessionId: activeSession ? activeSession._id : null,
    };
  },
});

export const startRemoteSession = mutation({
  args: {
    deviceId: v.id("devices"),
  },
  handler: async (ctx, { deviceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const device = await ctx.db.get(deviceId);
    if (!device) throw new Error("Device not found");

    await requireMember(ctx, userId, device.workspaceId);

    const sessionId = await ctx.db.insert("deviceSessions", {
      workspaceId: device.workspaceId,
      deviceId,
      userId,
      status: "active",
      startedAt: Date.now(),
    });

    return sessionId;
  },
});

export const getSession = query({
  args: { sessionId: v.id("deviceSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const session = await ctx.db.get(sessionId);
    if (!session) return null;
    await requireMember(ctx, userId, session.workspaceId);
    return session;
  },
});

export const endRemoteSession = mutation({
  args: { sessionId: v.id("deviceSessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return;

    await ctx.db.patch(sessionId, {
      status: "ended",
      endedAt: Date.now(),
    });
  },
});

export const sendSignal = mutation({
  args: {
    sessionId: v.id("deviceSessions"),
    sender: v.string(),
    type: v.string(),
    payload: v.string(),
  },
  handler: async (ctx, { sessionId, sender, type, payload }) => {
    await ctx.db.insert("deviceSignals", {
      sessionId,
      sender,
      type,
      payload,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, { deviceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const device = await ctx.db.get(deviceId);
    if (!device) throw new Error("Device not found");
    
    await requireMember(ctx, userId, device.workspaceId);

    await ctx.db.delete(deviceId);
  },
});

