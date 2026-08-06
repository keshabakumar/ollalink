import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { audit } from "./auditLog";
import { bump } from "./counters";
import { requireDevSeed } from "./devGuard";
import { notify } from "./notifications";

type Role = "owner" | "admin" | "member";

async function membership(
  ctx: QueryCtx,
  userId: Id<"users">,
  workspaceId: Id<"workspaces">,
) {
  return ctx.db
    .query("members")
    .withIndex("by_user_workspace", (q) =>
      q.eq("userId", userId).eq("workspaceId", workspaceId),
    )
    .unique();
}

export async function requireRole(
  ctx: QueryCtx,
  userId: Id<"users">,
  workspaceId: Id<"workspaces">,
  roles: Role[],
) {
  const m = await membership(ctx, userId, workspaceId);
  if (!m || !roles.includes(m.role as Role)) throw new ConvexError("Forbidden");
  return m;
}

export async function requireMember(
  ctx: QueryCtx,
  userId: Id<"users">,
  workspaceId: Id<"workspaces">,
) {
  return requireRole(ctx, userId, workspaceId, ["owner", "admin", "member"]);
}

async function createWorkspaceImpl(
  ctx: MutationCtx,
  userId: Id<"users">,
  name: string,
) {
  const now = Date.now();
  const workspaceId = await ctx.db.insert("workspaces", {
    name,
    ownerId: userId,
    createdAt: now,
  });
  await ctx.db.insert("members", {
    workspaceId,
    userId,
    role: "owner",
    createdAt: now,
  });
  await audit(ctx, workspaceId, userId, "workspace.create", { name });
  await bump(ctx, workspaceId, "members", 1);
  return workspaceId;
}

export const createWorkspace = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return createWorkspaceImpl(ctx, userId, name);
  },
});

export const createWorkspaceForUser = internalMutation({
  args: { userId: v.id("users"), name: v.string() },
  handler: async (ctx, { userId, name }) => {
    requireDevSeed();
    return createWorkspaceImpl(ctx, userId, name);
  },
});

export const ensureWorkspace = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) return existing.workspaceId;
    return createWorkspaceImpl(ctx, userId, "Personal");
  },
});

export const myWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const mems = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const out = [];
    for (const m of mems) {
      const ws = await ctx.db.get(m.workspaceId);
      if (ws) out.push({ ...ws, role: m.role });
    }
    return out;
  },
});

export const members = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    await requireMember(ctx, userId, workspaceId);
    const mems = await ctx.db
      .query("members")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const out = [];
    for (const m of mems) {
      const u = await ctx.db.get(m.userId);
      out.push({
        _id: m._id,
        role: m.role,
        email: u?.email,
        name: u?.name ?? u?.username,
      });
    }
    return out;
  },
});

// --- Invites ---

export const invite = mutation({
  args: { workspaceId: v.id("workspaces"), email: v.string(), role: v.string() },
  handler: async (ctx, { workspaceId, email, role }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requireRole(ctx, userId, workspaceId, ["owner", "admin"]);
    const id = await ctx.db.insert("invites", {
      workspaceId,
      email: email.toLowerCase(),
      role,
      invitedBy: userId,
      accepted: false,
      createdAt: Date.now(),
    });
    await audit(ctx, workspaceId, userId, "member.invite", {
      email: email.toLowerCase(),
      role,
    });
    const invitee = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email.toLowerCase()))
      .unique();
    if (invitee) {
      await notify(
        ctx,
        invitee._id,
        "invite",
        "Workspace invitation",
        `You were invited as ${role}`,
      );
    }
    return id;
  },
});

export const inviteForUser = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    invitedBy: v.id("users"),
    email: v.string(),
    role: v.string(),
  },
  handler: async (ctx, a) => {
    requireDevSeed();
    return ctx.db.insert("invites", {
      workspaceId: a.workspaceId,
      email: a.email.toLowerCase(),
      role: a.role,
      invitedBy: a.invitedBy,
      accepted: false,
      createdAt: Date.now(),
    });
  },
});

/** Pending invites for a workspace (admin view). */
export const pendingInvites = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    await requireRole(ctx, userId, workspaceId, ["owner", "admin"]);
    return ctx.db
      .query("invites")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .filter((q) => q.eq(q.field("accepted"), false))
      .collect();
  },
});

/** Pending invites addressed to the signed-in user's email. */
export const myInvites = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const u = await ctx.db.get(userId);
    if (!u?.email) return [];
    const invs = await ctx.db
      .query("invites")
      .withIndex("by_email", (q) =>
        q.eq("email", (u.email as string).toLowerCase()),
      )
      .filter((q) => q.eq(q.field("accepted"), false))
      .collect();
    const out = [];
    for (const inv of invs) {
      const ws = await ctx.db.get(inv.workspaceId);
      out.push({
        _id: inv._id,
        role: inv.role,
        workspaceId: inv.workspaceId,
        workspaceName: ws?.name,
      });
    }
    return out;
  },
});

async function acceptInviteImpl(
  ctx: MutationCtx,
  userId: Id<"users">,
  inviteId: Id<"invites">,
) {
  const inv = await ctx.db.get(inviteId);
  if (!inv || inv.accepted) throw new Error("Invite not found");
  const existing = await membership(ctx, userId, inv.workspaceId);
  if (!existing) {
    await ctx.db.insert("members", {
      workspaceId: inv.workspaceId,
      userId,
      role: inv.role,
      createdAt: Date.now(),
    });
    await bump(ctx, inv.workspaceId, "members", 1);
  }
  await ctx.db.patch(inviteId, { accepted: true });
  await audit(ctx, inv.workspaceId, userId, "member.join", { role: inv.role });
  return inv.workspaceId;
}

export const acceptInvite = mutation({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, { inviteId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const inv = await ctx.db.get(inviteId);
    const u = await ctx.db.get(userId);
    if (!inv) throw new ConvexError("Invite not found");
    if (inv.email && u?.email && inv.email.toLowerCase() !== u.email.toLowerCase()) {
      throw new ConvexError("Invite not for you");
    }
    return acceptInviteImpl(ctx, userId, inviteId);
  },
});

export const acceptInviteForUser = internalMutation({
  args: { inviteId: v.id("invites"), userId: v.id("users") },
  handler: async (ctx, { inviteId, userId }) => {
    requireDevSeed();
    return acceptInviteImpl(ctx, userId, inviteId);
  },
});

export const removeMember = mutation({
  args: { workspaceId: v.id("workspaces"), memberId: v.id("members") },
  handler: async (ctx, { workspaceId, memberId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");
    await requireRole(ctx, userId, workspaceId, ["owner", "admin"]);
    const m = await ctx.db.get(memberId);
    if (!m || m.workspaceId !== workspaceId) throw new ConvexError("Not found");
    if (m.role === "owner") throw new ConvexError("Cannot remove the owner");
    await ctx.db.delete(memberId);
    await bump(ctx, workspaceId, "members", -1);
    await audit(ctx, workspaceId, userId, "member.remove", { member: m.userId });
  },
});

export const changeRole = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    memberId: v.id("members"),
    role: v.string(),
  },
  handler: async (ctx, { workspaceId, memberId, role }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");
    await requireRole(ctx, userId, workspaceId, ["owner", "admin"]);
    if (!["admin", "member"].includes(role)) throw new ConvexError("Invalid role");
    const m = await ctx.db.get(memberId);
    if (!m || m.workspaceId !== workspaceId) throw new ConvexError("Not found");
    if (m.role === "owner") throw new ConvexError("Cannot change the owner's role");
    await ctx.db.patch(memberId, { role });
    await audit(ctx, workspaceId, userId, "member.role", { member: m.userId, role });
  },
});

/**
 * Permanently delete a workspace and ALL related data.
 * Only the owner can delete. Deletes: members, invites, jobs, files (metadata),
 * devices, deviceSessions, apiKeys, auditLogs, events, usage, counters, then
 * the workspace itself. Honest: this is a hard delete — no undo, no soft-delete.
 * deviceSignals has no by_workspace index so it's orphaned (harmless).
 */
export const deleteWorkspace = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");
    const m = await requireRole(ctx, userId, workspaceId, ["owner"]);
    if (m.role !== "owner") throw new ConvexError("Only the owner can delete the workspace");

    // Delete all rows in a table matching by_workspace index. Convex requires
    // literal table names at compile time, so we can't loop over a string array.
    const del = async (rows: { _id: Id<any> }[]) => {
      for (const r of rows) await ctx.db.delete(r._id);
    };

    const members = await ctx.db
      .query("members")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    await del(members);

    const invites = await ctx.db
      .query("invites")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    await del(invites);

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    await del(jobs);

    const files = await ctx.db
      .query("files")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    await del(files);

    const devices = await ctx.db
      .query("devices")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    await del(devices);

    const deviceSessions = await ctx.db
      .query("deviceSessions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    await del(deviceSessions);

    const apiKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    await del(apiKeys);

    const auditLogs = await ctx.db
      .query("auditLogs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    await del(auditLogs);

    const events = await ctx.db
      .query("events")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    await del(events);

    const usage = await ctx.db
      .query("usage")
      .withIndex("by_workspace_metric", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    await del(usage);

    const counters = await ctx.db
      .query("counters")
      .withIndex("by_workspace_metric", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    await del(counters);

    // Finally delete the workspace itself.
    await ctx.db.delete(workspaceId);
  },
});
