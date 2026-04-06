import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const claimsTable = pgTable(
  "claims",
  {
    id: serial("id").primaryKey(),

    summary: text("summary").notNull(),

    evidence: text("evidence"),
    evidenceType: text("evidence_type").notNull().default("self_attestation"),

    phrasingVariants: text("phrasing_variants").array().notNull().default([]),
    disallowedImplications: text("disallowed_implications")
      .array()
      .notNull()
      .default([]),

    domain: text("domain"),
    applicableTags: text("applicable_tags").array().notNull().default([]),

    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("claims_domain_active_idx").on(table.domain, table.isActive),
    index("claims_active_idx").on(table.isActive),
  ],
);

export const insertClaimSchema = createInsertSchema(claimsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClaim = z.infer<typeof insertClaimSchema>;
export type Claim = typeof claimsTable.$inferSelect;
