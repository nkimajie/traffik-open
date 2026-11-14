import * as crypto from "crypto";
import { KashiaWebhookPayload } from "../interfaces/kashia-webhook.interface";

/**
 * Verifies the `x-kashia-signature` header (`sha256=<hex HMAC>`).
 *
 * The HMAC is checked against the raw request bytes when available, since
 * re-serialising the parsed JSON can differ from what was signed (whitespace,
 * key order, number or unicode formatting). The re-serialised payload is still
 * accepted so existing deliveries keep verifying; both require the secret.
 */
export function verifyKashiaWebhookSignature(
  payload: KashiaWebhookPayload,
  signature: string | undefined,
  secret: string | undefined,
  rawBody?: Buffer | string,
): boolean {
  if (!signature?.startsWith("sha256=") || !secret) {
    return false;
  }

  const received = Buffer.from(signature);
  const candidates: Array<Buffer | string> = [];
  if (rawBody?.length) {
    candidates.push(rawBody);
  }
  candidates.push(JSON.stringify(payload));

  return candidates.some((body) => {
    const expected = Buffer.from(
      "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex"),
    );
    return (
      received.length === expected.length &&
      crypto.timingSafeEqual(received, expected)
    );
  });
}

export function resolveOrderIdFromMetadata(
  metadata?: Record<string, string | undefined>,
): string | undefined {
  if (!metadata) {
    return undefined;
  }

  return metadata.orderId || metadata.order_id;
}
