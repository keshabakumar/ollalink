// Temporary workaround for a convex / @convex-dev/auth version mismatch that
// causes generated DataModel types to emit Id<string> instead of Id<TableName>.
// This override lets the dashboard build until the dependency pair is aligned.

declare module "convex/values" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface GenericId<TableName> {
    __tableName: any;
  }
}
