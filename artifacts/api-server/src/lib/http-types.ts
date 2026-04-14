import type { Request, RequestHandler } from "express";

export type JobOpsSession = Request["session"] & {
  adminId?: number;
  totpVerified?: boolean;
};

export type JobOpsRequest = Request & {
  session: JobOpsSession;
};

export type SessionMiddlewareFactory = (options: Record<string, unknown>) => RequestHandler;
