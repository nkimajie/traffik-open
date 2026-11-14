import { KashiaWebhookEventStatus } from "../enums/kashia-webhook-event-status.enum";

/** Searchable fields copied from the payload onto the webhook record. */
export interface KashiaWebhookRecordMeta {
  reference?: string;
  orderId?: string;
}

export interface KashiaWebhookClaim {
  /** True when this delivery should be handled now. */
  claimed: boolean;
  /** When claimed: 1 for a first delivery, higher when retrying a failed/stale attempt. */
  attempt?: number;
  /** When not claimed: status of the earlier delivery that owns this webhook_id. */
  status?: KashiaWebhookEventStatus;
}
