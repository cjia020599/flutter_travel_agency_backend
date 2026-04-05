import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

export function useRatings(moduleType: 'car' | 'tour', moduleId: number) {
  return useQuery({
    queryKey: [api.ratings.listByModule.path, moduleType, moduleId],
    queryFn: async () => {
      const url = buildUrl(api.ratings.listByModule.path, { moduleType, moduleId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch ratings");
      return await res.json();
    },
  });
}

export function useUserRating(moduleType: 'car' | 'tour', moduleId: number) {
  return useQuery({
    queryKey: ['user-rating', moduleType, moduleId],
    queryFn: async () => {
      const ratings = await useRatings(moduleType, moduleId).refetch();
      const userId = localStorage.getItem('userId'); // Assume stored after login
      if (!userId) return null;
      return ratings.data?.find(r => r.userId === parseInt(userId)) || null;
    },
    enabled: false, // Manual trigger
  });
}

export function useCreateRating() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data) => {
      const res = await fetch(api.ratings.create.path, {
        method: api.ratings.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return await res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.ratings.listByModule.path, variables.moduleType, variables.moduleId] });
      toast({ title: "Rating added", description: "Your rating has been submitted." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

export function useUpdateRating() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const url = buildUrl(api.ratings.update.path, { id });
      const res = await fetch(url, {
        method: api.ratings.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return await res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.ratings.listByModule.path] });
      toast({ title: "Rating updated" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

export function useDeleteRating() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.ratings.delete.path, { id });
      const res = await fetch(url, { 
        method: api.ratings.delete.method, 
        credentials: "include" 
      });
      if (!res.ok) throw new Error("Failed to delete rating");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.ratings.listByModule.path] });
      toast({ title: "Rating deleted" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

