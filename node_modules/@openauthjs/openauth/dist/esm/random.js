// src/random.ts
import { timingSafeEqual } from "node:crypto";
function generateUnbiasedDigits(length) {
  const result = [];
  while (result.length < length) {
    const buffer = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const byte of buffer) {
      if (byte < 250 && result.length < length) {
        result.push(byte % 10);
      }
    }
  }
  return result.join("");
}
function timingSafeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
export {
  timingSafeCompare,
  generateUnbiasedDigits
};
