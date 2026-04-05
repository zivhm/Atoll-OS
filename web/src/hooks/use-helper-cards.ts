import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { listAgents, listRuntimeInstances, listTenants } from "@/lib/api";
import { buildDashboardHelperCards } from "@/lib/models";

export function useHelperCards() {
  const tenantsQuery = useQuery({
    queryKey: ["tenants"],
    queryFn: () => listTenants(),
  });
  const agentsQuery = useQuery({
    queryKey: ["agents"],
    queryFn: () => listAgents(),
  });
  const instancesQuery = useQuery({
    queryKey: ["instances"],
    queryFn: () => listRuntimeInstances(),
  });

  const cards = useMemo(
    () =>
      buildDashboardHelperCards(
        instancesQuery.data ?? [],
        agentsQuery.data ?? [],
        tenantsQuery.data ?? [],
      ),
    [agentsQuery.data, instancesQuery.data, tenantsQuery.data],
  );

  return {
    cards,
    agentsQuery,
    tenantsQuery,
    instancesQuery,
    loading:
      tenantsQuery.isLoading ||
      agentsQuery.isLoading ||
      instancesQuery.isLoading,
  };
}
