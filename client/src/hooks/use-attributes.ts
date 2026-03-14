import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useAttributes() {
  return useQuery({
    queryKey: [api.attributes.list.path],
    queryFn: async () => {
      const res = await fetch(api.attributes.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch attributes");
      return api.attributes.list.responses[200].parse(await res.json());
    },
  });
}
