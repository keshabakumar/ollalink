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
