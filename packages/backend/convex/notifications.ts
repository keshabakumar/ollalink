import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

/** Dependency-free helper to emit an in-app notification to a user. */
export async function notify(
  ctx: MutationCtx,
  userId: Id<"users">,
  type: string,
  title: string,
  body?: string,
) {
  await ctx.db.insert("notifications", {
    userId,
    type,
    title,
    body,
    read: false,
    createdAt: Date.now(),
  });
}

export const myNotifications = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
  },
});

export const myNotificationsPaged = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { page: [], isDone: true, continueCursor: "" };
    return ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate(paginationOpts);
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;
    // Indexed + capped: the bell only distinguishes 0..9 and "9+", so reading at
    // most 10 unread rows is enough — O(10) instead of O(all notifications).
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", userId).eq("read", false))
      .take(10);
    return rows.length;
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;
    // Process unread notifications in bounded batches to avoid unbounded .collect().
    const batchSize = 100;
    let unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", userId).eq("read", false))
      .take(batchSize);
    while (unread.length > 0) {
      for (const n of unread) {
        await ctx.db.patch(n._id, { read: true });
      }
      if (unread.length < batchSize) break;
      unread = await ctx.db
        .query("notifications")
        .withIndex("by_user_read", (q) =>
          q.eq("userId", userId).eq("read", false),
        )
        .take(batchSize);
    }
  },
});
