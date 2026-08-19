import { timingSafeEqual } from "node:crypto";

export function hasValidApiSecret(headerValue, expectedToken) {
  if (!expectedToken) return false;
  if (!headerValue) return false;

  const provided = Buffer.from(headerValue);
  const expected = Buffer.from(expectedToken);

  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}
