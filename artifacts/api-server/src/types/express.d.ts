/**
 * Express session type augmentation.
 *
 * Extends the `express-session` Session interface with our custom fields
 * so TypeScript knows what to expect in `req.session` throughout the codebase.
 */
declare module "express-session" {
  interface SessionData {
    /** The authenticated admin user's ID (from admin_users.id). Set on login. */
    adminId: number;
    /** Whether the user has completed the TOTP step (if 2FA is enabled). */
    totpVerified: boolean;
  }
}
