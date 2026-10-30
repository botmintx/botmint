import { createHash } from "node:crypto";

export function sha256(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export function sha256Bytes(data: string | Uint8Array): Buffer {
  return createHash("sha256").update(data).digest();
}

export function sha256Prefixed(data: string | Uint8Array): string {
  return `sha256:${sha256(data)}`;
}

/** Provenance over 32-byte digests in token order. */
export function hashChain(hexDigests: string[]): string {
  const bytes = Buffer.concat(hexDigests.map((hex) => Buffer.from(hex, "hex")));
  return sha256(bytes);
}
