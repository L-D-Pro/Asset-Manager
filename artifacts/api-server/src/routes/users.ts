import { Router, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { db } from "@workspace/db";
import { adminUsersTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import type { JobOpsRequest } from "../lib/http-types";

const usersRouter = Router();
const BCRYPT_ROUNDS = 12;

/** Generate a strong random password using a CSPRNG. */
function generatePassword(length = 16): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*-_+=";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(randomInt(0, charset.length));
  }
  return password;
}

/** Middleware that ensures the current user has role='admin'. */
async function requireAdmin(req: JobOpsRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.session.adminId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await db.query.adminUsersTable.findFirst({
    where: eq(adminUsersTable.id, req.session.adminId),
    columns: { id: true, role: true },
  });

  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  next();
}

// ─── GET /api/users ──────────────────────────────────────────────────────────

usersRouter.get("/users", requireAuth, requireAdmin, async (req: JobOpsRequest, res): Promise<void> => {
  const users = await db.query.adminUsersTable.findMany({
    columns: { passwordHash: false, totpSecret: false, totpRecoveryCodes: false },
    orderBy: (users, { asc }) => [asc(users.createdAt)],
  });

  res.json(users);
});

// ─── POST /api/users ─────────────────────────────────────────────────────────

usersRouter.post("/users", requireAuth, requireAdmin, async (req: JobOpsRequest, res): Promise<void> => {
  const { username, firstName, lastName, email, role } = req.body as {
    username?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
  };

  if (!username || !email) {
    res.status(400).json({ error: "Username and email are required" });
    return;
  }

  const cleanUsername = username.toLowerCase().trim();
  if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
    res.status(400).json({ error: "Username must be lowercase alphanumeric with underscores only" });
    return;
  }

  // Check for duplicate username
  const existing = await db.query.adminUsersTable.findFirst({
    where: eq(adminUsersTable.username, cleanUsername),
  });

  if (existing) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const [newUser] = await db
    .insert(adminUsersTable)
    .values({
      username: cleanUsername,
      firstName: firstName?.trim() || null,
      lastName: lastName?.trim() || null,
      email: email.trim(),
      role: role === "admin" ? "admin" : "user",
      passwordHash,
    })
    .returning({
      id: adminUsersTable.id,
      username: adminUsersTable.username,
      firstName: adminUsersTable.firstName,
      lastName: adminUsersTable.lastName,
      email: adminUsersTable.email,
      role: adminUsersTable.role,
      createdAt: adminUsersTable.createdAt,
      updatedAt: adminUsersTable.updatedAt,
    });

  logger.info({ userId: newUser.id, createdBy: req.session.adminId }, "User created by admin");

  // Return the generated password ONCE so the admin can share it
  res.status(201).json({ ...newUser, generatedPassword: password });
});

// ─── PUT /api/users/:id ──────────────────────────────────────────────────────

usersRouter.put("/users/:id", requireAuth, requireAdmin, async (req: JobOpsRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const { username, firstName, lastName, email, role } = req.body as {
    username?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
  };

  const updates: Partial<typeof adminUsersTable.$inferInsert> = { updatedAt: new Date() };

  if (username !== undefined) {
    const cleanUsername = username.toLowerCase().trim();
    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      res.status(400).json({ error: "Username must be lowercase alphanumeric with underscores only" });
      return;
    }

    // Check for duplicate username (excluding self)
    const existing = await db.query.adminUsersTable.findFirst({
      where: eq(adminUsersTable.username, cleanUsername),
    });
    if (existing && existing.id !== id) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }
    updates.username = cleanUsername;
  }

  if (firstName !== undefined) updates.firstName = firstName.trim() || null;
  if (lastName !== undefined) updates.lastName = lastName.trim() || null;
  if (email !== undefined) updates.email = email.trim();
  if (role !== undefined) updates.role = role === "admin" ? "admin" : "user";

  const [updated] = await db
    .update(adminUsersTable)
    .set(updates)
    .where(eq(adminUsersTable.id, id))
    .returning({
      id: adminUsersTable.id,
      username: adminUsersTable.username,
      firstName: adminUsersTable.firstName,
      lastName: adminUsersTable.lastName,
      email: adminUsersTable.email,
      role: adminUsersTable.role,
      createdAt: adminUsersTable.createdAt,
      updatedAt: adminUsersTable.updatedAt,
    });

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  logger.info({ userId: id, updatedBy: req.session.adminId }, "User updated by admin");
  res.json(updated);
});

// ─── DELETE /api/users/:id ───────────────────────────────────────────────────

usersRouter.delete("/users/:id", requireAuth, requireAdmin, async (req: JobOpsRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  // Prevent self-deletion
  if (id === req.session.adminId) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }

  // Prevent deletion of the last admin
  const target = await db.query.adminUsersTable.findFirst({
    where: eq(adminUsersTable.id, id),
    columns: { id: true, role: true },
  });

  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (target.role === "admin") {
    const adminCount = await db
      .select({ value: count() })
      .from(adminUsersTable)
      .where(eq(adminUsersTable.role, "admin"));

    if (adminCount[0]?.value === 1) {
      res.status(400).json({ error: "Cannot delete the last admin account" });
      return;
    }
  }

  await db.delete(adminUsersTable).where(eq(adminUsersTable.id, id));

  logger.info({ userId: id, deletedBy: req.session.adminId }, "User deleted by admin");
  res.json({ ok: true });
});

// ─── POST /api/users/:id/reset-password ──────────────────────────────────────

usersRouter.post("/users/:id/reset-password", requireAuth, requireAdmin, async (req: JobOpsRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const user = await db.query.adminUsersTable.findFirst({
    where: eq(adminUsersTable.id, id),
    columns: { id: true },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await db
    .update(adminUsersTable)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(adminUsersTable.id, id));

  logger.info({ userId: id, resetBy: req.session.adminId }, "Password reset by admin");
  res.json({ ok: true, generatedPassword: password });
});

export default usersRouter;
