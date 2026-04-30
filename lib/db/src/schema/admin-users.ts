import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";

/**
 * Users table — stores all account credentials.
 *
 * Originally designed for a single admin, now supports multiple users
 * with role-based access. The bootstrap admin gets role='admin';
 * additional users get role='user'.
 *
 * Extended for public pilot launch with email verification,
 * password reset tokens, pilot enrollment tracking, and usage limits.
 *
 * Security notes:
 * - `passwordHash` stores a bcryptjs hash (cost factor 12). Never store plaintext.
 * - `totpSecret` stores the base32-encoded TOTP secret, encrypted at rest ideally
 *   (currently stored as-is in PostgreSQL). If deploying on DigitalOcean, enable
 *   encrypted storage on the database cluster.
 * - `totpEnabled` gates whether TOTP is required at login.
 * - `totpRecoveryCodes` holds a JSON array of single-use recovery codes (hashed).
 * - `emailConfirmationToken` is a 32-byte hex token with 24h expiry.
 * - `passwordResetToken` is a 32-byte hex token with 1h expiry.
 */
export const adminUsersTable = pgTable("admin_users", {
  /** Auto-incrementing primary key. */
  id: serial("id").primaryKey(),

  /** Username used for login. Lowercase, alphanumeric. */
  username: text("username").notNull().unique(),

  /** First name for display purposes. */
  firstName: text("first_name"),

  /** Last name for display purposes. */
  lastName: text("last_name"),

  /** Contact email — used for email verification and password reset flows. */
  email: text("email").notNull(),

  /** User role: 'admin' or 'user'. */
  role: text("role").notNull().default("user"),

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

  // ── Email Verification ──────────────────────────────────────────────────
  /** Whether the user's email has been verified. Login blocked until true. */
  emailVerified: boolean("email_verified").notNull().default(false),

  /** Token for email confirmation link. 32-byte hex. Null after verification. */
  emailConfirmationToken: text("email_confirmation_token"),

  /** Expiry for email confirmation token (24 hours after generation). */
  emailConfirmationExpires: timestamp("email_confirmation_expires", { withTimezone: true }),

  // ── Password Reset ──────────────────────────────────────────────────────
  /** Token for password reset link. 32-byte hex. Null after reset. */
  passwordResetToken: text("password_reset_token"),

  /** Expiry for password reset token (1 hour after generation). */
  passwordResetExpires: timestamp("password_reset_expires", { withTimezone: true }),

  // ── Pilot Enrollment ────────────────────────────────────────────────────
  /** Whether user is enrolled in the pilot program. */
  isPilotParticipant: boolean("is_pilot_participant").notNull().default(false),

  /** How the user enrolled: "invite" or "waitlist". */
  pilotEnrollmentType: text("pilot_enrollment_type"),

  /** When the user accepted the Pilot Terms. */
  pilotTermsAcceptedAt: timestamp("pilot_terms_accepted_at", { withTimezone: true }),

  // ── UTM Tracking ────────────────────────────────────────────────────────
  /** UTM source captured at registration (e.g., "linkedin"). */
  utmSource: text("utm_source"),

  /** UTM medium captured at registration (e.g., "social"). */
  utmMedium: text("utm_medium"),

  /** UTM campaign captured at registration (e.g., "pilot_launch"). */
  utmCampaign: text("utm_campaign"),

  // ── Account Status ──────────────────────────────────────────────────────
  /** Whether the account is active. Inactive accounts cannot log in. */
  isActive: boolean("is_active").notNull().default(true),

  /** Timestamp of account creation. */
  createdAt: timestamp("created_at").notNull().defaultNow(),

  /** Timestamp of last account update. */
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AdminUser = typeof adminUsersTable.$inferSelect;
export type NewAdminUser = typeof adminUsersTable.$inferInsert;
