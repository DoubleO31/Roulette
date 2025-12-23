import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type GameState } from "@shared/schema";

// POST /api/sessions
export function useCreateSession() {
  return useMutation({
    mutationFn: async (input?: { name?: string; initialBalance: number; unitValue: number }) => {
      const res = await fetch(api.sessions.create.path, {
        method: api.sessions.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(api.sessions.create.input?.parse(input ?? {}) ?? {}),
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to create session');
      return api.sessions.create.responses[201].parse(await res.json());
    },
  });
}

// GET /api/sessions
export function useSessions() {
  return useQuery({
    queryKey: [api.sessions.list.path],
    queryFn: async () => {
      const res = await fetch(api.sessions.list.path, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch sessions');
      return api.sessions.list.responses[200].parse(await res.json());
    },
  });
}

// GET /api/sessions/:id
export function useSession(id: number) {
  return useQuery({
    queryKey: [api.sessions.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.sessions.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) throw new Error('Session not found');
      if (!res.ok) throw new Error('Failed to fetch session');
      // The response is dynamic GameState, validating strictly might need a complex schema, 
      // but we can trust the API types for now or use the generic GameState type.
      return await res.json() as GameState;
    },
    enabled: !!id && !isNaN(id),
    refetchInterval: 1000, // Polling for real-time feel if needed, though mutation updates cache
  });
}

// DELETE /api/sessions/:id
export function useDeleteSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.sessions.delete.path, { id });
      const res = await fetch(url, { method: api.sessions.delete.method, credentials: "include" });
      if (res.status === 404) throw new Error('Session not found');
      if (!res.ok) throw new Error('Failed to delete session');
      return null;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: [api.sessions.list.path] });
      queryClient.removeQueries({ queryKey: [api.sessions.get.path, id] });
    },
  });
}

// POST /api/spins
export function useAddSpin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, result }: { sessionId: number, result: string }) => {
      const validated = api.spins.create.input.parse({ sessionId, result });
      const res = await fetch(api.spins.create.path, {
        method: api.spins.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
         const error = await res.json().catch(() => ({}));
         throw new Error(error.message || 'Failed to add spin');
      }
      return await res.json() as GameState;
    },
    onSuccess: (data, variables) => {
      // Update the session query with the new game state immediately
      queryClient.setQueryData([api.sessions.get.path, variables.sessionId], data);
    },
  });
}
