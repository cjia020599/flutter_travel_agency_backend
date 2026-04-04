import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth, setToken, removeToken, getToken } from "@/lib/auth";
import type { AuthUser, RegisterInput, LoginInput } from "@shared/schema";

const PROFILE_KEY = "/api/user/profile";

export function useProfile() {
  return useQuery<AuthUser | null>({
    queryKey: [PROFILE_KEY],
    queryFn: async () => {
      if (!getToken()) return null;
      const res = await fetchWithAuth(PROFILE_KEY);
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Login failed");
      }
      return res.json() as Promise<{ token: string; user: AuthUser }>;
    },
    onSuccess: (data) => {
      setToken(data.token);
      queryClient.setQueryData([PROFILE_KEY], data.user);
      queryClient.invalidateQueries({ queryKey: [PROFILE_KEY] });
      toast({ title: "Welcome back!", description: `Logged in as ${data.user.username}` });
      navigate("/");
    },
    onError: (e: Error) => {
      toast({ title: "Login failed", description: e.message, variant: "destructive" });
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  return useMutation({
    mutationFn: async (input: RegisterInput) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Registration failed");
      }
      return res.json() as Promise<{ token: string; user: AuthUser }>;
    },
    onSuccess: (data) => {
      setToken(data.token);
      queryClient.setQueryData([PROFILE_KEY], data.user);
      queryClient.invalidateQueries({ queryKey: [PROFILE_KEY] });
      toast({ title: "Account created!", description: `Welcome, ${data.user.username}!` });
      navigate("/");
    },
    onError: (e: Error) => {
      toast({ title: "Registration failed", description: e.message, variant: "destructive" });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  return () => {
    removeToken();
    queryClient.setQueryData([PROFILE_KEY], null);
    queryClient.clear();
    navigate("/login");
  };
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: Partial<AuthUser>) => {
      const res = await fetchWithAuth("/api/user/profile", {
        method: "PUT",
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Update failed");
      }
      return res.json() as Promise<AuthUser>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData([PROFILE_KEY], data);
      toast({ title: "Profile updated", description: "Your profile has been saved." });
    },
    onError: (e: Error) => {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    },
  });
}
