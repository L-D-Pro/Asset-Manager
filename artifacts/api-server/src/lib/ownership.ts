import type { JobOpsRequest } from "./http-types";

export function currentUserId(req: JobOpsRequest): number {
  return req.session.adminId!;
}

export function withoutUserId<T extends { userId?: unknown }>(
  row: T,
): Omit<T, "userId"> {
  const { userId: _userId, ...publicRow } = row;
  return publicRow;
}

export function withoutUserIds<T extends { userId?: unknown }>(
  rows: T[],
): Array<Omit<T, "userId">> {
  return rows.map(withoutUserId);
}
