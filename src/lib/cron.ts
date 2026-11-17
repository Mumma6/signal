import "server-only";
import { timingSafeEqual } from "node:crypto";
export function authorizedCron(authorization: string | null, secret: string | undefined) {
  if (!secret || secret.length < 32 || !authorization) return false;
  const actual = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
