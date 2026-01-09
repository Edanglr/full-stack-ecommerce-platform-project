// backend/src/utils/email.js
import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT || 587),
  secure: false,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

/**
 * Invoice email
 * Supports BOTH:
 *  - pdfBuffer (preferred)
 *  - pdfPath (fallback, used by current orderRoutes)
 */
export async function sendInvoiceEmail({ to, name, orderId, pdfBuffer, pdfPath }) {
  try {
    if (!to) return;

    const safeOrderId = orderId || "order";
    const safeName = name || "Customer";

    const attachments = [];
    if (pdfBuffer) {
      attachments.push({
        filename: `invoice-${safeOrderId}.pdf`,
        content: pdfBuffer,
      });
    } else if (pdfPath) {
      attachments.push({
        filename: `invoice-${safeOrderId}.pdf`,
        path: pdfPath,
      });
    }

    const mailOptions = {
      from: SMTP_FROM || SMTP_USER,
      to,
      subject: "Your Invoice",
      text: `Hi ${safeName},\n\nYour invoice for order ${safeOrderId} is attached.\n\nLa Strada`,
      attachments,
    };

    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error("Failed to send invoice email:", err?.message || err);
  }
}

export async function sendDiscountEmail(toEmail, userName, products, discountRate) {
  const pct = Math.round(Number(discountRate) * 100);

  const safeName = userName || "there";
  const items = Array.isArray(products) ? products : [];

  const productLines = items
    .map((p) => {
      const name = p?.name || "Product";
      const price = p?.price != null ? Number(p.price).toFixed(2) : "";
      return `• ${name}${price ? ` — ${price} TL` : ""}`;
    })
    .join("\n");

  const subject = `Good news! ${pct}% discount on your wishlist items`;

  const text =
    `Hi ${safeName},\n\n` +
    `A ${pct}% discount has just been applied to items in your wishlist!\n\n` +
    `Discounted items:\n${productLines || "• (No items listed)"}\n\n` +
    `Visit La Strada to check the updated prices.\n\n` +
    `Best regards,\nLa Strada Team`;

  return await transporter.sendMail({
    from: `"Campus Shop" <${SMTP_FROM || SMTP_USER}>`,
    to: toEmail,
    subject,
    text,
  });
}

/**
 * Refund approval email
 */
export async function sendRefundApprovalEmail({
  to,
  name,
  returnId,
  orderId,
  productName,
  quantity,
  refundedAmount,
}) {
  try {
    if (!to) return;

    const mailOptions = {
      from: SMTP_FROM || SMTP_USER,
      to,
      subject: "Refund Approved",
      text: `Hi ${name || "Customer"},

Your refund request has been approved.

Return ID: ${returnId}
Order ID: ${orderId}
Product: ${productName}
Quantity: ${quantity}

Refunded amount: ${Number(refundedAmount || 0).toFixed(2)} TL

The refund is processed using the same purchase-time price (including any discount).

La Strada`,
    };

    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error("Failed to send refund approval email:", err?.message || err);
  }
}
