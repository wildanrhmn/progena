"use client";

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { agentRegistryContract } from "@/lib/contracts";

export function useNames(ids: readonly bigint[]) {
  const uniqueIds = useMemo(() => {
    const set = new Set<string>();
    const out: bigint[] = [];
    for (const id of ids) {
      const k = id.toString();
      if (!set.has(k)) {
        set.add(k);
        out.push(id);
      }
    }
    return out;
  }, [ids]);

  const { data } = useReadContracts({
    contracts: uniqueIds.map(
      (id) =>
        ({
          ...agentRegistryContract,
          functionName: "nameOf",
          args: [id],
        }) as const
    ),
    allowFailure: true,
    query: { enabled: uniqueIds.length > 0, staleTime: 60_000 },
  });

  return useMemo(() => {
    const map = new Map<string, string>();
    if (!data) return map;
    uniqueIds.forEach((id, i) => {
      const r = data[i];
      if (r?.status === "success") {
        const name = r.result as string;
        if (name && name.length > 0) map.set(id.toString(), name);
      }
    });
    return map;
  }, [data, uniqueIds]);
}

export function nameOrId(id: bigint, names: Map<string, string>): string {
  return names.get(id.toString()) ?? `#${id.toString()}`;
}
