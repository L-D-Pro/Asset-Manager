import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface AuthUser {
 id: number;
 username: string;
 firstName: string | null;
 lastName: string | null;
 email: string;
 role: string;
 totpEnabled: boolean;
 createdAt: string;
 updatedAt: string;
}

interface AuthContextValue {
 /** The currently authenticated user, null if not logged in, undefined while loading. */
 user: AuthUser | null | undefined;
 /** Log in with username + password. Returns { totpRequired: true } if 2FA is needed. */
 login: (username: string, password: string) => Promise<{ totpRequired?: boolean }>;
 /** Complete the TOTP verification step after password login. */
 verifyTotp: (token: string) => Promise<void>;
 /** Log the user out. */
 logout: () => Promise<void>;
 /** Re-fetch the current user (useful after profile changes). */
 refetch: () => Promise<void>;
 /** Register a new account (public). Returns user id on success. */
 register: (data: { username: string; email: string; password: string; inviteCode: string }) => Promise<{ id: number }>;
 /** Resend email verification. Always returns ok for anti-enumeration. */
 resendVerification: (email: string) => Promise<void>;
 /** Request a password reset email. Always returns ok for anti-enumeration. */
 requestPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
 const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

 const fetchMe = useCallback(async () => {
 try {
 const res = await fetch("/api/auth/me", { credentials: "include" });
 if (res.ok) {
 const data = await res.json() as AuthUser;
 setUser(data);
 } else {
 setUser(null);
 }
 } catch {
 setUser(null);
 }
 }, []);

 useEffect(() => {
 void fetchMe();
 }, [fetchMe]);

 const login = useCallback(async (username: string, password: string) => {
 const res = await fetch("/api/auth/login", {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ username, password }),
 });

 if (!res.ok) {
 const err = await res.json() as { error: string };
 throw new Error(err.error ?? "Login failed");
 }

 const data = await res.json() as { totpRequired?: boolean };

 if (!data.totpRequired) {
 // Fully authenticated — fetch user data
 await fetchMe();
 }

 return data;
 }, [fetchMe]);

 const verifyTotp = useCallback(async (token: string) => {
 const res = await fetch("/api/auth/login/totp", {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ token }),
 });

 if (!res.ok) {
 const err = await res.json() as { error: string };
 throw new Error(err.error ?? "TOTP verification failed");
 }

 await fetchMe();
 }, [fetchMe]);

 const logout = useCallback(async () => {
 await fetch("/api/auth/logout", {
 method: "POST",
 credentials: "include",
 });
 setUser(null);
 }, []);

 const register = useCallback(async (data: { username: string; email: string; password: string; inviteCode: string }) => {
 const utmRaw = localStorage.getItem("jobops_utm");
 const utm = utmRaw ? JSON.parse(utmRaw) : {};
 const res = await fetch("/api/auth/register", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 username: data.username,
 email: data.email,
 password: data.password,
 inviteCode: data.inviteCode,
 utmSource: utm.source ?? undefined,
 utmMedium: utm.medium ?? undefined,
 utmCampaign: utm.campaign ?? undefined,
 }),
 });

 if (!res.ok) {
 const err = await res.json() as { error: string };
 throw new Error(err.error ?? "Registration failed");
 }

 localStorage.removeItem("jobops_utm");
 return res.json() as Promise<{ id: number }>;
 }, []);

 const resendVerification = useCallback(async (email: string) => {
 await fetch("/api/auth/resend-verification", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ email }),
 });
 }, []);

 const requestPasswordReset = useCallback(async (email: string) => {
 await fetch("/api/auth/forgot-password", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ email }),
 });
 }, []);

 return (
 <AuthContext.Provider value={{ user, login, verifyTotp, logout, refetch: fetchMe, register, resendVerification, requestPasswordReset }}>
 {children}
 </AuthContext.Provider>
 );
}

export function useAuth() {
 const ctx = useContext(AuthContext);
 if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
 return ctx;
}
