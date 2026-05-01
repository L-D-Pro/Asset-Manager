import type { Response, NextFunction } from "express";
import type { JobOpsRequest } from "../lib/http-types";
import { getOrCreateUserStats, awardXp } from "../lib/gamification";

/**
 * Authentication middleware.
 *
 * Protects all routes that require an authenticated session.
 * Checks for `req.session.adminId` (set on successful login).
 *
 * If 2FA is enabled and the user has not yet completed the TOTP step
 * (`totpVerified` is false), they are treated as unauthenticated even
 * if they passed the password check.
 *
 * Public routes (health check, auth endpoints) are whitelisted and
 * do not go through this middleware — see `routes/index.ts`.
 */
export async function requireAuth(req: JobOpsRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.session.adminId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // If the session was started but TOTP not yet verified, block access.
  // totpVerified is explicitly set to false during the password-OK / awaiting-TOTP phase.
  if (req.session.totpVerified === false) {
    res.status(401).json({ error: "TOTP verification required", totpRequired: true });
    return;
  }

  const stats = await getOrCreateUserStats(req.session.adminId).catch(() => null);
  if (stats) {
    const today = new Date().toISOString().slice(0, 10);
    if (stats.lastActivityDate !== today) {
      awardXp(req.session.adminId, "daily_login", {}).catch(() => {});
    }
  }

  next();
}
