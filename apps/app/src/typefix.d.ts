// Temporary workaround for a convex / @convex-dev/auth version mismatch.
// Originally this augmented GenericId with __tableName: string to make Id<string>
// structurally compatible with Id<TableName>. But that breaks the reverse:
// GenericId<"users"> (from getAuthUserId) becomes incompatible with Id<"users">
// (expected by requireMember/audit). The casts at call sites handle the
// Id<string> issue without breaking GenericId->Id assignment, so this file
// is now intentionally empty. Kept to avoid breaking the tsconfig include.

export {};
