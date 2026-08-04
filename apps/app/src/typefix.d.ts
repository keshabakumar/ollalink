// Temporary workaround for a convex / @convex-dev/auth version mismatch that
// causes generated DataModel types to emit Id<string> instead of Id<TableName>.
// This override lets the dashboard build until the dependency pair is aligned.

declare module "convex/values" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface GenericId<TableName> {
    // Using string instead of the table-specific literal makes Id types
    // structurally compatible, which is required by the corrupted generated types.
    __tableName: string;
  }
}
