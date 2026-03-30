import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

type CreateTourInput = z.infer<typeof api.tours.create.input>;
type UpdateTourInput = z.infer<typeof api.tours.update.input>;

export function useTours(filters?: { location_id?: string; status?: string }) {
  return useQuery({
    queryKey: [api.tours.list.path, filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters as Record<string, string>);
      const url = `${api.tours.list.path}?${params}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tours");
      return api.tours.list.responses[200].parse(await res.json());
    },
  });
}

export function useTour(id?: number) {
  return useQuery({
    queryKey: [api.tours.get.path, id],
    queryFn: async () => {
      if (!id) return null;
      const url = buildUrl(api.tours.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch tour");
      return api.tours.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateTour() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateTourInput) => {
      const res = await fetch(api.tours.create.path, {
        method: api.tours.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.tours.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create tour");
      }
      return api.tours.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tours.list.path] });
      toast({ title: "Tour created", description: "The tour has been successfully created." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

export function useUpdateTour() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & UpdateTourInput) => {
      const url = buildUrl(api.tours.update.path, { id });
      const res = await fetch(url, {
        method: api.tours.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) throw new Error("Tour not found");
        throw new Error("Failed to update tour");
      }
      return api.tours.update.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.tours.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.tours.get.path, variables.id] });
      toast({ title: "Tour updated", description: "The tour has been successfully updated." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

export function useDeleteTour() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.tours.delete.path, { id });
      const res = await fetch(url, { method: api.tours.delete.method, credentials: "include" });
      if (res.status === 404) throw new Error("Tour not found");
      if (!res.ok) throw new Error("Failed to delete tour");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tours.list.path] });
      toast({ title: "Tour deleted", description: "The tour has been removed." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}
