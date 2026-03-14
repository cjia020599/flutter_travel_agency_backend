import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

type CreateCarInput = z.infer<typeof api.cars.create.input>;
type UpdateCarInput = z.infer<typeof api.cars.update.input>;

export function useCars(filters?: { location_id?: string; status?: string }) {
  return useQuery({
    queryKey: [api.cars.list.path, filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters as Record<string, string>);
      const url = `${api.cars.list.path}?${params}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cars");
      return api.cars.list.responses[200].parse(await res.json());
    },
  });
}

export function useCar(id?: number) {
  return useQuery({
    queryKey: [api.cars.get.path, id],
    queryFn: async () => {
      if (!id) return null;
      const url = buildUrl(api.cars.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch car");
      return api.cars.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateCar() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateCarInput) => {
      const res = await fetch(api.cars.create.path, {
        method: api.cars.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.cars.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create car");
      }
      return api.cars.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.cars.list.path] });
      toast({ title: "Car created", description: "The car has been successfully created." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

export function useUpdateCar() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & UpdateCarInput) => {
      const url = buildUrl(api.cars.update.path, { id });
      const res = await fetch(url, {
        method: api.cars.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) throw new Error("Car not found");
        throw new Error("Failed to update car");
      }
      return api.cars.update.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.cars.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.cars.get.path, variables.id] });
      toast({ title: "Car updated", description: "The car has been successfully updated." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

export function useDeleteCar() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.cars.delete.path, { id });
      const res = await fetch(url, { method: api.cars.delete.method, credentials: "include" });
      if (res.status === 404) throw new Error("Car not found");
      if (!res.ok) throw new Error("Failed to delete car");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.cars.list.path] });
      toast({ title: "Car deleted", description: "The car has been removed." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}
