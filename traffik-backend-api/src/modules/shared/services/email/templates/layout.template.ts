const BRAND = {
  pink: "#FF5390",
  amber: "#F5B341",
  green: "#68AF6B",
  heading: "#030803",
  body: "#484848",
  muted: "#6B7280",
  border: "#E5E7EB",
  background: "#F9FAFB",
} as const;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatNaira(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export interface LayoutOptions {
  title: string;
  preheader?: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}

export function renderLayout(options: LayoutOptions): string {
  const title = escapeHtml(options.title);
  const preheader = escapeHtml(options.preheader || options.title);
  const footerNote = options.footerNote
    ? `<p style="margin:16px 0 0;color:${BRAND.muted};font-size:12px;line-height:1.5;">${escapeHtml(options.footerNote)}</p>`
    : "";

  const cta =
    options.ctaLabel && options.ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
          <tr>
            <td style="border-radius:8px;background:${BRAND.pink};">
              <a href="${escapeHtml(options.ctaUrl)}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(options.ctaLabel)}</a>
            </td>
          </tr>
        </table>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.background};font-family:Arial,Helvetica,sans-serif;color:${BRAND.body};">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.background};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:20px 24px;background:#ffffff;border-bottom:4px solid ${BRAND.pink};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:22px;font-weight:700;font-style:italic;color:${BRAND.heading};letter-spacing:0.5px;">TRAFFIK</td>
                  <td align="right">
                    <span style="display:inline-block;width:10px;height:10px;background:${BRAND.pink};transform:skewX(-20deg);margin-left:2px;"></span>
                    <span style="display:inline-block;width:10px;height:10px;background:${BRAND.amber};transform:skewX(-20deg);margin-left:2px;"></span>
                    <span style="display:inline-block;width:10px;height:10px;background:${BRAND.green};transform:skewX(-20deg);margin-left:2px;"></span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${BRAND.heading};">${title}</h1>
              ${options.bodyHtml}
              ${cta}
              ${footerNote}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background:#FAFAFA;border-top:1px solid ${BRAND.border};">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${BRAND.muted};">
                Shop smart. Sell easy. Every Traffik order is protected by Kashia escrow.
              </p>
              <p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:${BRAND.muted};">
                &copy; ${new Date().getFullYear()} Traffik. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderOrderItemsTable(
  items: { name: string; quantity: number; price: number }[],
): string {
  const rows = items
    .map(
      (item) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font-size:14px;color:${BRAND.body};">${escapeHtml(item.name)}</td>
        <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font-size:14px;color:${BRAND.body};text-align:center;">${item.quantity}</td>
        <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font-size:14px;color:${BRAND.body};text-align:right;">${formatNaira(item.price)}</td>
      </tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 0;border-collapse:collapse;">
    <tr>
      <th align="left" style="padding:0 0 8px;font-size:12px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.4px;">Item</th>
      <th align="center" style="padding:0 0 8px;font-size:12px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.4px;">Qty</th>
      <th align="right" style="padding:0 0 8px;font-size:12px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.4px;">Price</th>
    </tr>
    ${rows}
  </table>`;
}
