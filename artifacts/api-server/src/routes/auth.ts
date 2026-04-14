import { Router } from "express";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import { db } from "@workspace/db";
import { adminUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import type { JobOpsRequest } from "../lib/http-types";

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

async function getAdmin() {
  const users = await db.select().from(adminUsersTable).limit(1);
  return users[0] ?? null;
}

/** Hashes a password with bcrypt. */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Compares a plaintext password to a bcrypt hash. */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Generates 8 single-use recovery codes (10-char hex each). */
function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    codes.push(
      Array.from({ length: 10 }, () => Math.floor(Math.random() * 16).toString(16)).join("")
    );
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

  const admin = await getAdmin();

  // Always run bcrypt to prevent timing attacks even if user doesn't exist
  const fakeHash = "$2a$12$fakehashfakehashfakehashfakehashfakehasXXXXXXXXXXXXXXX";
  const hash = admin?.passwordHash ?? fakeHash;
  const passwordOk = await verifyPassword(password, hash);

  if (!admin || !passwordOk || admin.username !== username.toLowerCase().trim()) {
    logger.warn({ username }, "Failed login attempt");
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  // Password is correct. Regenerate session to prevent fixation attacks.
  req.session.regenerate((err: unknown) => {
    if (err) {
      logger.error({ err }, "Session regeneration failed");
      res.status(500).json({ error: "Internal server error" });
      return;
    }

    req.session.adminId = admin.id;

    if (admin.totpEnabled) {
      // Signal that TOTP is still required — protect all other routes until done.
      req.session.totpVerified = false;
      logger.info({ adminId: admin.id }, "Login: password OK, TOTP required");
      res.json({ totpRequired: true });
    } else {
      // No 2FA — fully authenticated.
      req.session.totpVerified = true;
      logger.info({ adminId: admin.id }, "Login successful (no 2FA)");
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

  const admin = await db.query.adminUsersTable.findFirst({
    where: eq(adminUsersTable.id, req.session.adminId),
    columns: { passwordHash: false, totpSecret: false, totpRecoveryCodes: false },
  });

  if (!admin) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json(admin);
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

  if (!email || !email.includes("@")) {
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

export default authRouter;
