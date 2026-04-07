import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";

/**
 * Admin users table — stores the single founder/admin account credentials.
 *
 * This is a private single-user tool. There is exactly one record in this table.
 *
 * Security notes:
 * - `passwordHash` stores a bcryptjs hash (cost factor 12). Never store plaintext.
 * - `totpSecret` stores the base32-encoded TOTP secret, encrypted at rest ideally
 *   (currently stored as-is in PostgreSQL). If deploying on DigitalOcean, enable
 *   encrypted storage on the database cluster.
 * - `totpEnabled` gates whether TOTP is required at login.
 * - `totpRecoveryCodes` holds a JSON array of single-use recovery codes (hashed).
 */
export const adminUsersTable = pgTable("admin_users", {
  /** Auto-incrementing primary key (only one row expected). */
  id: serial("id").primaryKey(),

  /** Username used for login. Lowercase, alphanumeric. */
  username: text("username").notNull().unique(),

  /** Contact email — not used for login, only for account management display. */
  email: text("email").notNull(),

  /** bcryptjs hash of the user's password (cost factor 12). */
  passwordHash: text("password_hash").notNull(),

  /**
   * Base32-encoded TOTP secret (compatible with Google Authenticator).
   * Null when 2FA has never been set up.
   */
  totpSecret: text("totp_secret"),

  /** Whether TOTP verification is required at login. */
  totpEnabled: boolean("totp_enabled").notNull().default(false),

  /**
   * JSON array of hashed single-use recovery codes.
   * Each code is bcrypt-hashed so plaintext is never stored.
   * Null until 2FA is first enabled.
   */
  totpRecoveryCodes: text("totp_recovery_codes"),

  /** Timestamp of account creation. */
  createdAt: timestamp("created_at").notNull().defaultNow(),

  /** Timestamp of last account update. */
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AdminUser = typeof adminUsersTable.$inferSelect;
export type NewAdminUser = typeof adminUsersTable.$inferInsert;
