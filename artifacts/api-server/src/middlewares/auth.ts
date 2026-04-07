import type { Request, Response, NextFunction } from "express";

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
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
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

  next();
}
