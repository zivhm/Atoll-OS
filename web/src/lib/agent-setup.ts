type QueryInvalidator = {
  invalidateQueries: (filters: { queryKey: string[] }) => Promise<unknown>;
};

const POST_LAUNCH_QUERY_KEYS = [
  ["instances"],
  ["agents"],
  ["tenants"],
  ["events"],
  ["provision-jobs"],
  ["provision-requests"],
] as const;

export function refreshPostLaunchQueries(queryClient: QueryInvalidator): void {
  void Promise.allSettled(
    POST_LAUNCH_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey: [...queryKey] }))
  );
}
