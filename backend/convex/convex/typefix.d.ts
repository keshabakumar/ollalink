// Temporary workaround for a convex / @convex-dev/auth version mismatch that
// causes generated DataModel types to only expose SystemIndexes on tables,
// dropping custom indexes like by_workspace, by_user, etc.
// This augmentation lets the backend typecheck until the dependency pair is aligned.

declare module "convex/server" {
  interface IndexKeys {
    [key: string]: string;
  }

  interface GenericIndexBuilder<TableName, IndexName> {
    eq: (field: string, value: any) => any;
  }

  interface GenericQueryBuilder<TableName> {
    withIndex<IndexName extends string>(
      indexName: IndexName,
      cb: (q: GenericIndexBuilder<TableName, IndexName>) => any,
    ): any;
  }
}
