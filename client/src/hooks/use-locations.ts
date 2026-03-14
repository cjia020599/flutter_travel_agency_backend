import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useLocations() {
  return useQuery({
    queryKey: [api.locations.list.path],
    queryFn: async () => {
      const res = await fetch(api.locations.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch locations");
      return api.locations.list.responses[200].parse(await res.json());
    },
  });
}
