import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const ONBOARDING_KEY = ["onboarding"];

export interface OnboardingState {
 userId: number;
 hasSeenWelcome: boolean;
 completedSteps: string[];
 dismissedHints: string[];
 progress: number;
 isComplete: boolean;
 createdAt: string;
 updatedAt: string;
}

async function apiGet(path: string) {
 const res = await fetch(`/api${path}`, { credentials: "include" });
 if (!res.ok) throw new Error(`HTTP ${res.status} GET ${path} failed`);
 return res.json();
}

async function apiPost(path: string, body?: unknown) {
 const res = await fetch(`/api${path}`, {
 method: "POST",
 credentials: "include",
 headers: body ? { "Content-Type": "application/json" } : undefined,
 body: body ? JSON.stringify(body) : undefined,
 });
 if (!res.ok) throw new Error(`POST ${path} failed`);
 return res.json();
}

export function useOnboardingState() {
 return useQuery<OnboardingState>({
 queryKey: ONBOARDING_KEY,
 queryFn: () => apiGet("/onboarding/state"),
 staleTime: 300_000,
 refetchOnWindowFocus: false,
 refetchOnReconnect: false,
 refetchOnMount: false,
 });
}

export function useMarkWelcomeSeen() {
 const qc = useQueryClient();
 return useMutation({
 mutationFn: () => apiPost("/onboarding/welcome-seen"),
 onSuccess: () => {
 qc.invalidateQueries({ queryKey: ONBOARDING_KEY });
 },
 });
}

export function useCompleteStep() {
 const qc = useQueryClient();
 return useMutation({
 mutationFn: (step: string) => apiPost("/onboarding/complete-step", { step }),
 onSuccess: () => {
 qc.invalidateQueries({ queryKey: ONBOARDING_KEY });
 },
 });
}

export function useDismissHint() {
 const qc = useQueryClient();
 return useMutation({
 mutationFn: (pagePath: string) => apiPost("/onboarding/dismiss-hint", { pagePath }),
 onSuccess: () => {
 qc.invalidateQueries({ queryKey: ONBOARDING_KEY });
 },
 });
}
