import * as crypto from "crypto";
import { verifyKashiaWebhookSignature } from "./kashia-webhook.util";
import { KashiaWebhookPayload } from "../interfaces/kashia-webhook.interface";

const SECRET = "whsec_test";
const sign = (body: string | Buffer, secret = SECRET) =>
  "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");

describe("verifyKashiaWebhookSignature", () => {
  // Formatting a provider may send that JSON.stringify would not reproduce.
  const rawBody =
    '{ "event": "escrow.active", "webhook_id": "wh_1", "timestamp": "2025-01-01T00:00:00Z", "data": { "id": "esc_1", "reference": "ref_\\u00e9" } }';
  const payload = JSON.parse(rawBody) as KashiaWebhookPayload;

  it("accepts a signature computed over the raw request body", () => {
    const raw = Buffer.from(rawBody);
    expect(verifyKashiaWebhookSignature(payload, sign(raw), SECRET, raw)).toBe(
      true,
    );
  });

  it("still accepts a signature over the re-serialised payload", () => {
    const signature = sign(JSON.stringify(payload));
    expect(
      verifyKashiaWebhookSignature(
        payload,
        signature,
        SECRET,
        Buffer.from(rawBody),
      ),
    ).toBe(true);
    expect(verifyKashiaWebhookSignature(payload, signature, SECRET)).toBe(true);
  });

  it("rejects a signature made with a different secret", () => {
    const raw = Buffer.from(rawBody);
    expect(
      verifyKashiaWebhookSignature(payload, sign(raw, "wrong"), SECRET, raw),
    ).toBe(false);
  });

  it("rejects a tampered body", () => {
    const raw = Buffer.from(rawBody);
    const tampered = Buffer.from(rawBody.replace("esc_1", "esc_2"));
    expect(
      verifyKashiaWebhookSignature(
        JSON.parse(tampered.toString()),
        sign(raw),
        SECRET,
        tampered,
      ),
    ).toBe(false);
  });

  it("rejects missing or malformed signatures and a missing secret", () => {
    const raw = Buffer.from(rawBody);
    expect(verifyKashiaWebhookSignature(payload, undefined, SECRET, raw)).toBe(
      false,
    );
    expect(verifyKashiaWebhookSignature(payload, "deadbeef", SECRET, raw)).toBe(
      false,
    );
    expect(
      verifyKashiaWebhookSignature(payload, "sha256=abc", SECRET, raw),
    ).toBe(false);
    expect(
      verifyKashiaWebhookSignature(payload, sign(raw), undefined, raw),
    ).toBe(false);
  });
});
