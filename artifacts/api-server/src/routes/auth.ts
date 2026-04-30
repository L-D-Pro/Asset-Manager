import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import { db } from "@workspace/db";
import { adminUsersTable, inviteCodesTable, userUsageLimitsTable } from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import type { JobOpsRequest } from "../lib/http-types";
import { resendService } from "../lib/resend-service";
import { checkUsageLimit } from "../lib/usage-limit";

/**
 * Auth router — all routes are mounted at /api/auth
 *
 * Public routes (no auth required):
 *   POST /api/auth/login        — username + password, returns session cookie
 *   POST /api/auth/login/totp   — TOTP verification after password step
 *   POST /api/auth/logout       — destroys the session
 *   GET  /api/auth/me           — returns current user info (or 401)
 *
 * Protected routes (require active session):
 *   PUT  /api/auth/password     — change password
 *   PUT  /api/auth/email        — change email
 *   POST /api/auth/2fa/setup    — generate TOTP secret + QR code
 *   POST /api/auth/2fa/enable   — verify TOTP code to confirm setup and enable 2FA
 *   POST /api/auth/2fa/disable  — disable 2FA (requires TOTP code as confirmation)
 *   POST /api/auth/2fa/recovery — list recovery codes (hashed; shows if any remain)
 *
 * 2FA login flow:
 *   1. POST /api/auth/login      — password OK → session.adminId set, session.totpVerified = false
 *   2. POST /api/auth/login/totp — TOTP OK → session.totpVerified = true
 *   3. All protected routes check requireAuth which validates totpVerified
 */
const authRouter = Router();

const BCRYPT_ROUNDS = 12;
const APP_NAME = "JobOps";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getUserByUsername(username: string) {
  const user = await db.query.adminUsersTable.findFirst({
    where: eq(adminUsersTable.username, username.toLowerCase().trim()),
  });
  return user ?? null;
}

/** Hashes a password with bcrypt. */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Compares a plaintext password to a bcrypt hash. */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Generates 8 single-use recovery codes (10-char hex each) using a CSPRNG. */
function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    codes.push(randomBytes(5).toString("hex"));
  }
  return codes;
}

/** Hashes all recovery codes with bcrypt for secure storage. */
async function hashRecoveryCodes(codes: string[]): Promise<string> {
  const hashed = await Promise.all(codes.map(c => bcrypt.hash(c, BCRYPT_ROUNDS)));
  return JSON.stringify(hashed);
}

// ─── POST /api/auth/login ────────────────────────────────────────────────────

authRouter.post("/auth/login", async (req: JobOpsRequest, res): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const user = await getUserByUsername(username);

  // Always run bcrypt to prevent timing attacks even if user doesn't exist
  const fakeHash = "$2a$12$fakehashfakehashfakehashfakehashfakehasXXXXXXXXXXXXXXX";
  const hash = user?.passwordHash ?? fakeHash;
  const passwordOk = await verifyPassword(password, hash);

  if (!user || !passwordOk) {
    logger.warn({ username }, "Failed login attempt");
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  if (!user.emailVerified) {
    logger.warn({ adminId: user.id }, "Login blocked: email not verified");
    res.status(403).json({ error: "Please verify your email before logging in. Check your inbox or request a new verification email." });
    return;
  }

  if (!user.isActive) {
    logger.warn({ adminId: user.id }, "Login blocked: account inactive");
    res.status(403).json({ error: "Your account has been deactivated. Contact support." });
    return;
  }

  // Password is correct. Regenerate session to prevent fixation attacks.
  req.session.regenerate((err: unknown) => {
    if (err) {
      logger.error({ err }, "Session regeneration failed");
      res.status(500).json({ error: "Internal server error" });
      return;
    }

    req.session.adminId = user.id;

    if (user.totpEnabled) {
      // Signal that TOTP is still required — protect all other routes until done.
      req.session.totpVerified = false;
      logger.info({ adminId: user.id }, "Login: password OK, TOTP required");
      res.json({ totpRequired: true });
    } else {
      // No 2FA — fully authenticated.
      req.session.totpVerified = true;
      logger.info({ adminId: user.id }, "Login successful (no 2FA)");
      res.json({ ok: true });
    }
  });
});

// ─── POST /api/auth/login/totp ──────────────────────────────────────────────

authRouter.post("/auth/login/totp", async (req: JobOpsRequest, res): Promise<void> => {
  if (!req.session.adminId) {
    res.status(401).json({ error: "Complete password login first" });
    return;
  }

  const { token, recoveryCode } = req.body as { token?: string; recoveryCode?: string };

  const admin = await db.query.adminUsersTable.findFirst({
    where: eq(adminUsersTable.id, req.session.adminId),
  });

  if (!admin || !admin.totpSecret) {
    res.status(400).json({ error: "2FA not configured" });
    return;
  }

  // Try TOTP token first
  if (token) {
    const valid = speakeasy.totp.verify({ secret: admin.totpSecret, encoding: "base32", token });
    if (!valid) {
      logger.warn({ adminId: admin.id }, "Invalid TOTP token");
      res.status(401).json({ error: "Invalid or expired TOTP code" });
      return;
    }

    req.session.totpVerified = true;
    logger.info({ adminId: admin.id }, "Login successful (TOTP verified)");
    res.json({ ok: true });
    return;
  }

  // Try recovery code
  if (recoveryCode && admin.totpRecoveryCodes) {
    const hashes: string[] = JSON.parse(admin.totpRecoveryCodes);
    let matchIndex = -1;

    for (let i = 0; i < hashes.length; i++) {
      const match = await bcrypt.compare(recoveryCode.trim().toLowerCase(), hashes[i]!);
      if (match) {
        matchIndex = i;
        break;
      }
    }

    if (matchIndex === -1) {
      logger.warn({ adminId: admin.id }, "Invalid recovery code");
      res.status(401).json({ error: "Invalid recovery code" });
      return;
    }

    // Consume the used recovery code (remove it from the list)
    hashes.splice(matchIndex, 1);
    await db
      .update(adminUsersTable)
      .set({ totpRecoveryCodes: JSON.stringify(hashes), updatedAt: new Date() })
      .where(eq(adminUsersTable.id, admin.id));

    req.session.totpVerified = true;
    logger.info({ adminId: admin.id }, "Login successful (recovery code used)");
    res.json({ ok: true, codesRemaining: hashes.length });
    return;
  }

  res.status(400).json({ error: "Provide either a TOTP token or a recovery code" });
});

// ─── POST /api/auth/logout ──────────────────────────────────────────────────

authRouter.post("/auth/logout", (req: JobOpsRequest, res): void => {
  req.session.destroy((err: unknown) => {
    if (err) {
      logger.error({ err }, "Session destroy failed");
      res.status(500).json({ error: "Logout failed" });
      return;
    }
    res.clearCookie("jobops.sid");
    res.json({ ok: true });
  });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────

authRouter.get("/auth/me", async (req: JobOpsRequest, res): Promise<void> => {
  if (!req.session.adminId || req.session.totpVerified === false) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await db.query.adminUsersTable.findFirst({
    where: eq(adminUsersTable.id, req.session.adminId),
    columns: { passwordHash: false, totpSecret: false, totpRecoveryCodes: false },
  });

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json(user);
});

// ─── PUT /api/auth/password ─────────────────────────────────────────────────

authRouter.put("/auth/password", requireAuth, async (req: JobOpsRequest, res): Promise<void> => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "currentPassword and newPassword are required" });
    return;
  }

  if (newPassword.length < 12) {
    res.status(400).json({ error: "New password must be at least 12 characters" });
    return;
  }

  const admin = await db.query.adminUsersTable.findFirst({
    where: eq(adminUsersTable.id, req.session.adminId!),
  });

  if (!admin) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const ok = await verifyPassword(currentPassword, admin.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const newHash = await hashPassword(newPassword);
  await db
    .update(adminUsersTable)
    .set({ passwordHash: newHash, updatedAt: new Date() })
    .where(eq(adminUsersTable.id, admin.id));

  logger.info({ adminId: admin.id }, "Password changed");
  res.json({ ok: true });
});

// ─── PUT /api/auth/email ─────────────────────────────────────────────────────

authRouter.put("/auth/email", requireAuth, async (req: JobOpsRequest, res): Promise<void> => {
  const { email } = req.body as { email?: string };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }

  await db
    .update(adminUsersTable)
    .set({ email, updatedAt: new Date() })
    .where(eq(adminUsersTable.id, req.session.adminId!));

  logger.info({ adminId: req.session.adminId }, "Email updated");
  res.json({ ok: true });
});

// ─── POST /api/auth/2fa/setup ────────────────────────────────────────────────

authRouter.post("/auth/2fa/setup", requireAuth, async (req: JobOpsRequest, res): Promise<void> => {
  const admin = await db.query.adminUsersTable.findFirst({
    where: eq(adminUsersTable.id, req.session.adminId!),
  });

  if (!admin) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (admin.totpEnabled) {
    res.status(400).json({ error: "2FA is already enabled. Disable it first." });
    return;
  }

  // Generate a new TOTP secret
  const secretObj = speakeasy.generateSecret({ length: 20, name: `${APP_NAME}:${admin.username}`, issuer: APP_NAME });
  const secret = secretObj.base32;
  const otpauth = secretObj.otpauth_url ?? speakeasy.otpauthURL({ type: "totp", label: `${APP_NAME}:${admin.username}`, secret, issuer: APP_NAME, encoding: "base32" });
  const qrDataUrl = await qrcode.toDataURL(otpauth);

  // Store the secret temporarily (not yet enabled — user must verify)
  await db
    .update(adminUsersTable)
    .set({ totpSecret: secret, totpEnabled: false, updatedAt: new Date() })
    .where(eq(adminUsersTable.id, admin.id));

  logger.info({ adminId: admin.id }, "2FA setup initiated");
  res.json({ secret, qrDataUrl, otpauth });
});

// ─── POST /api/auth/2fa/enable ───────────────────────────────────────────────

authRouter.post("/auth/2fa/enable", requireAuth, async (req: JobOpsRequest, res): Promise<void> => {
  const { token } = req.body as { token?: string };

  if (!token) {
    res.status(400).json({ error: "TOTP token is required to confirm 2FA setup" });
    return;
  }

  const admin = await db.query.adminUsersTable.findFirst({
    where: eq(adminUsersTable.id, req.session.adminId!),
  });

  if (!admin || !admin.totpSecret) {
    res.status(400).json({ error: "Run 2FA setup first" });
    return;
  }

  const valid = speakeasy.totp.verify({ secret: admin.totpSecret, encoding: "base32", token });
  if (!valid) {
    res.status(401).json({ error: "Invalid TOTP code. Check your authenticator app." });
    return;
  }

  // Generate recovery codes
  const plainCodes = generateRecoveryCodes();
  const hashedCodes = await hashRecoveryCodes(plainCodes);

  await db
    .update(adminUsersTable)
    .set({ totpEnabled: true, totpRecoveryCodes: hashedCodes, updatedAt: new Date() })
    .where(eq(adminUsersTable.id, admin.id));

  logger.info({ adminId: admin.id }, "2FA enabled");

  // Return recovery codes ONCE in plaintext — user must save these
  res.json({ ok: true, recoveryCodes: plainCodes });
});

// ─── POST /api/auth/2fa/disable ─────────────────────────────────────────────

authRouter.post("/auth/2fa/disable", requireAuth, async (req: JobOpsRequest, res): Promise<void> => {
  const { token } = req.body as { token?: string };

  if (!token) {
    res.status(400).json({ error: "Current TOTP token required to disable 2FA" });
    return;
  }

  const admin = await db.query.adminUsersTable.findFirst({
    where: eq(adminUsersTable.id, req.session.adminId!),
  });

  if (!admin || !admin.totpSecret) {
    res.status(400).json({ error: "2FA is not enabled" });
    return;
  }

  const valid = speakeasy.totp.verify({ secret: admin.totpSecret, encoding: "base32", token });
  if (!valid) {
    res.status(401).json({ error: "Invalid TOTP code" });
    return;
  }

  await db
    .update(adminUsersTable)
    .set({ totpEnabled: false, totpSecret: null, totpRecoveryCodes: null, updatedAt: new Date() })
    .where(eq(adminUsersTable.id, admin.id));

  logger.info({ adminId: admin.id }, "2FA disabled");
  res.json({ ok: true });
});

// ─── POST /api/auth/2fa/regenerate-codes ────────────────────────────────────

authRouter.post("/auth/2fa/regenerate-codes", requireAuth, async (req: JobOpsRequest, res): Promise<void> => {
  const { token } = req.body as { token?: string };

  if (!token) {
    res.status(400).json({ error: "Current TOTP token required to regenerate recovery codes" });
    return;
  }

  const admin = await db.query.adminUsersTable.findFirst({
    where: eq(adminUsersTable.id, req.session.adminId!),
  });

  if (!admin || !admin.totpSecret || !admin.totpEnabled) {
    res.status(400).json({ error: "2FA is not enabled" });
    return;
  }

  const valid = speakeasy.totp.verify({ secret: admin.totpSecret, encoding: "base32", token });
  if (!valid) {
    res.status(401).json({ error: "Invalid TOTP code" });
    return;
  }

  const plainCodes = generateRecoveryCodes();
  const hashedCodes = await hashRecoveryCodes(plainCodes);

  await db
    .update(adminUsersTable)
    .set({ totpRecoveryCodes: hashedCodes, updatedAt: new Date() })
    .where(eq(adminUsersTable.id, admin.id));

  logger.info({ adminId: admin.id }, "Recovery codes regenerated");
  res.json({ ok: true, recoveryCodes: plainCodes });
});

// ── POST /api/auth/register ──────────────────────────────────────────────────

authRouter.post("/auth/register", async (req: JobOpsRequest, res): Promise<void> => {
  const { username, email, password, inviteCode, utmSource, utmMedium, utmCampaign } = req.body as {
    username?: string;
    email?: string;
    password?: string;
    inviteCode?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  };

  const usernameRegex = /^[a-z0-9_]+$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!username || !usernameRegex.test(username)) {
    res.status(400).json({ error: "Username must be lowercase alphanumeric with underscores only" });
    return;
  }
  if (!email || !emailRegex.test(email)) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }
  if (!password || password.length < 12) {
    res.status(400).json({ error: "Password must be at least 12 characters" });
    return;
  }
  if (!inviteCode) {
    res.status(400).json({ error: "Invite code is required" });
    return;
  }

  const codeStr = inviteCode.trim().toUpperCase();
  const [invite] = await db
    .select()
    .from(inviteCodesTable)
    .where(eq(inviteCodesTable.code, codeStr));

  if (!invite || !invite.isActive || new Date() > invite.expiresAt) {
    res.status(400).json({ error: "Invalid or expired invitation code" });
    return;
  }
  if (invite.usedCount >= invite.maxUses) {
    res.status(400).json({ error: "This invite code has reached its limit" });
    return;
  }

  const [existing] = await db
    .select({ id: adminUsersTable.id })
    .from(adminUsersTable)
    .where(eq(adminUsersTable.username, username.toLowerCase().trim()));

  if (existing) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const confirmationToken = randomBytes(32).toString("hex");
  const confirmationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const [user] = await db
    .insert(adminUsersTable)
    .values({
      username: username.toLowerCase().trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      role: "user",
      emailVerified: false,
      emailConfirmationToken: confirmationToken,
      emailConfirmationExpires: new Date(confirmationExpires),
      isPilotParticipant: true,
      pilotEnrollmentType: "invite",
      pilotTermsAcceptedAt: new Date(),
      utmSource: utmSource ?? null,
      utmMedium: utmMedium ?? null,
      utmCampaign: utmCampaign ?? null,
    })
    .returning();

  if (!user) {
    res.status(500).json({ error: "Failed to create account" });
    return;
  }

  await db
    .update(inviteCodesTable)
    .set({ usedCount: invite.usedCount + 1 })
    .where(eq(inviteCodesTable.id, invite.id));

  await db.insert(userUsageLimitsTable).values({ userId: user.id });

  resendService.sendConfirmationEmail(user.email, confirmationToken, undefined);

  logger.info({ userId: user.id, inviteCode: codeStr }, "User registered");
  res.status(201).json({ id: user.id, message: "Account created. Check your email to verify." });
});

// ── GET /api/auth/verify-email/:token ────────────────────────────────────────

authRouter.get("/auth/verify-email/:token", async (req: JobOpsRequest, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [user] = await db
    .select()
    .from(adminUsersTable)
    .where(eq(adminUsersTable.emailConfirmationToken, token));

  if (!user) {
    res.redirect("/login?error=invalid_token");
    return;
  }
  if (user.emailConfirmationExpires && new Date() > user.emailConfirmationExpires) {
    res.redirect("/login?error=expired_token");
    return;
  }

  await db
    .update(adminUsersTable)
    .set({
      emailVerified: true,
      emailConfirmationToken: null,
      emailConfirmationExpires: null,
    })
    .where(eq(adminUsersTable.id, user.id));

  resendService.sendWelcomeEmail(user.email, user.firstName ?? undefined);

  logger.info({ userId: user.id }, "Email verified");
  res.redirect("/login?verified=1");
});

// ── POST /api/auth/resend-verification ────────────────────────────────────────

authRouter.post("/auth/resend-verification", async (req: JobOpsRequest, res): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email) {
    res.json({ ok: true });
    return;
  }

  const [user] = await db
    .select()
    .from(adminUsersTable)
    .where(eq(adminUsersTable.email, email.trim().toLowerCase()));

  if (!user || user.emailVerified) {
    res.json({ ok: true });
    return;
  }

  const confirmationToken = randomBytes(32).toString("hex");
  const confirmationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await db
    .update(adminUsersTable)
    .set({ emailConfirmationToken: confirmationToken, emailConfirmationExpires: new Date(confirmationExpires) })
    .where(eq(adminUsersTable.id, user.id));

  resendService.sendConfirmationEmail(user.email, confirmationToken, user.firstName ?? undefined);

  res.json({ ok: true });
});

// ── POST /api/auth/forgot-password ────────────────────────────────────────────

authRouter.post("/auth/forgot-password", async (req: JobOpsRequest, res): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email) {
    res.json({ ok: true });
    return;
  }

  const [user] = await db
    .select()
    .from(adminUsersTable)
    .where(eq(adminUsersTable.email, email.trim().toLowerCase()));

  if (!user) {
    res.json({ ok: true });
    return;
  }

  const resetToken = randomBytes(32).toString("hex");
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await db
    .update(adminUsersTable)
    .set({ passwordResetToken: resetToken, passwordResetExpires: new Date(resetExpires) })
    .where(eq(adminUsersTable.id, user.id));

  resendService.sendPasswordReset(user.email, resetToken, user.firstName ?? undefined);

  logger.info({ userId: user.id }, "Password reset requested");
  res.json({ ok: true });
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────

authRouter.post("/auth/reset-password", async (req: JobOpsRequest, res): Promise<void> => {
  const { token, password } = req.body as { token?: string; password?: string };

  if (!token || !password) {
    res.status(400).json({ error: "Token and password are required" });
    return;
  }
  if (password.length < 12) {
    res.status(400).json({ error: "Password must be at least 12 characters" });
    return;
  }

  const [user] = await db
    .select()
    .from(adminUsersTable)
    .where(eq(adminUsersTable.passwordResetToken, token));

  if (!user) {
    res.status(400).json({ error: "Invalid or expired reset token" });
    return;
  }
  if (user.passwordResetExpires && new Date() > user.passwordResetExpires) {
    res.status(400).json({ error: "Reset token has expired" });
    return;
  }

  const passwordHash = await hashPassword(password);

  await db
    .update(adminUsersTable)
    .set({ passwordHash, passwordResetToken: null, passwordResetExpires: null })
    .where(eq(adminUsersTable.id, user.id));

  logger.info({ userId: user.id }, "Password reset completed");
  res.json({ ok: true });
});

export default authRouter;
