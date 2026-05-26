#!/usr/bin/env node
/**
 * Bootstrap script: create the initial admin user.
 *
 * Run once on first deployment:
 *   corepack pnpm exec tsx artifacts/api-server/scripts/create-admin.ts
 *
 * Or set environment variables and run:
 *   ADMIN_USERNAME=admin ADMIN_PASSWORD=yourpassword ADMIN_EMAIL=you@example.com \
 *   corepack pnpm exec tsx artifacts/api-server/scripts/create-admin.ts
 *
 * If the admin user already exists, the script exits cleanly.
 *
 * Minimum password length: 12 characters.
 */

import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const pool = new Pool({ connectionString: url });

  // Check if admin already exists
  const existing = await pool.query("SELECT id FROM admin_users LIMIT 1");
  if (existing.rows.length > 0) {
    console.log("Admin user already exists. Nothing to do.");
    await pool.end();
    return;
  }

  const username = (process.env.ADMIN_USERNAME ?? "admin").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  const email = process.env.ADMIN_EMAIL ?? "admin@localhost";

  if (!password) {
    throw new Error(
      "ADMIN_PASSWORD environment variable is required. Set it and re-run.\n" +
      "Minimum length: 12 characters."
    );
  }

  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }

  const hash = await bcrypt.hash(password, 12);

  await pool.query(
    `INSERT INTO admin_users (
       username,
       email,
       role,
       password_hash,
       totp_enabled,
       email_verified,
       is_active,
       created_at,
       updated_at
     )
     VALUES ($1, $2, 'admin', $3, false, true, true, NOW(), NOW())`,
    [username, email, hash],
  );

  console.log(`✓ Admin user '${username}' created successfully.`);
  console.log(`  Email: ${email}`);
  console.log("  2FA: disabled (enable from the Account page after first login)");
  await pool.end();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
