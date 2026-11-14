import { refundSentTemplate } from "./refund-sent.template";

describe("refundSentTemplate", () => {
  const data = {
    name: "Ada",
    orderRef: "TRF-ABC123",
    amount: 2000,
    methodLabel: "Bank transfer",
    reference: "FT-0001",
    note: "To your GTBank account",
    orderUrl: "https://traffik.example/account/orders/1",
    reportWindowDays: 30,
  };

  it("gives the shopper the amount, reference and how to report a missing refund", () => {
    const html = refundSentTemplate.html(data);
    const text = refundSentTemplate.text(data);

    for (const body of [html, text]) {
      expect(body).toContain("FT-0001");
      expect(body).toContain("Bank transfer");
      expect(body).toContain("30 days");
    }
    expect(refundSentTemplate.subject(data)).toContain("TRF-ABC123");
  });

  it("escapes admin-entered text", () => {
    const html = refundSentTemplate.html({
      ...data,
      reference: '<img src=x onerror="alert(1)">',
      note: "<script>alert(1)</script>",
    });

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });
});
