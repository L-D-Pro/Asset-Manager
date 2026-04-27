import { rateLimit, type Options } from "express-rate-limit";

const defaultOptions: Partial<Options> = {
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.ip ?? "unknown"),
};

/** Rate limiter for login attempts: 5 per 15 minutes per IP. */
export const loginRateLimit = rateLimit({
  ...defaultOptions,
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many login attempts. Please try again later." },
});

/** Rate limiter for TOTP verification: 10 per 15 minutes per IP. */
export const totpRateLimit = rateLimit({
  ...defaultOptions,
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many verification attempts. Please try again later." },
});

/** Rate limiter for logout: 20 per minute per IP. */
export const logoutRateLimit = rateLimit({
  ...defaultOptions,
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Too many logout attempts. Please try again later." },
});
