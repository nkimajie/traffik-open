import { OrderStatus } from "../../../orders/enums/order.enum";
import { Config } from "../../../../config/configuration";

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING_PAYMENT]: "Awaiting payment",
  [OrderStatus.PENDING]: "Pending",
  [OrderStatus.ACCEPTED]: "Accepted by store",
  [OrderStatus.REJECTED]: "Declined by store",
  [OrderStatus.PROCESSING]: "Processing",
  [OrderStatus.SHIPPED]: "Shipped",
  [OrderStatus.DELIVERED]: "Delivered",
  [OrderStatus.CANCELLED]: "Cancelled",
};

export function getOrderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status] || status;
}

export function getAppWebUrl(path = ""): string {
  const base = (Config.getValue("APP_WEB_URL") || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getSupportEmail(): string {
  return Config.getValue("SMTP_FROM_EMAIL") || Config.getValue("SMTP_USER") || "support@traffik.ng";
}
