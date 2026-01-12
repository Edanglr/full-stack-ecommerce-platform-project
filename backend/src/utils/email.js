// backend/src/utils/email.js
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM;

// Demo/kanıt için outbox
const OUTBOX_DIR = path.resolve(process.cwd(), "outbox");
if (!fs.existsSync(OUTBOX_DIR)) fs.mkdirSync(OUTBOX_DIR, { recursive: true });

function saveOutbox(type, payload) {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(OUTBOX_DIR, `${type}-${ts}.json`);
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf-8");
    return file;
  } catch (e) {
    console.error("OUTBOX write failed:", e?.message || e);
    return null;
  }
}

function createTransporter() {
  // SMTP yoksa: demo modu (throw yok)
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn("⚠️ SMTP env missing. Using jsonTransport (demo mode) and saving emails into ./outbox");
    return nodemailer.createTransport({ jsonTransport: true });
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: false,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

const transporter = createTransporter();

/**
 * Invoice email sender (backward compatible)
 * Supports:
 *  - pdfBuffer (Buffer)  -> attachment content
 *  - pdfPath (string)    -> attachment path
 */
export async function sendInvoiceEmail({ to, name, orderId, pdfBuffer, pdfPath }) {
  try {
    if (!to) return { ok: false, message: "Missing recipient" };

    const attachments = [];
    if (pdfBuffer) {
      attachments.push({ filename: `invoice-${orderId}.pdf`, content: pdfBuffer });
    } else if (pdfPath) {
      attachments.push({ filename: `invoice-${orderId}.pdf`, path: pdfPath });
    }

    const mailOptions = {
      from: SMTP_FROM || SMTP_USER || "no-reply@lastrada.local",
      to,
      subject: "Your Invoice",
      text: `Hi ${name || "Customer"},\n\nYour invoice for order ${orderId} is attached.\n\nLa Strada`,
      attachments,
    };

    const info = await transporter.sendMail(mailOptions);

    const outboxFile = saveOutbox("invoice", {
      to,
      subject: mailOptions.subject,
      orderId,
      used: SMTP_HOST ? "smtp" : "jsonTransport",
      nodemailerInfo: info,
      pdfPath: pdfPath || null,
      hasBuffer: Boolean(pdfBuffer),
      at: new Date().toISOString(),
    });

    return { ok: true, outboxFile };
  } catch (err) {
    console.error("Failed to send invoice email:", err?.message || err);
    return { ok: false, message: err?.message || "sendInvoiceEmail failed" };
  }
}

export async function sendDiscountEmail(toEmail, userName, products, discountRate) {
  try {
    if (!toEmail) return { ok: false, message: "Missing recipient" };

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

    const mailOptions = {
      from: `"Campus Shop" <${SMTP_FROM || SMTP_USER || "no-reply@lastrada.local"}>`,
      to: toEmail,
      subject,
      text,
    };

    const info = await transporter.sendMail(mailOptions);

    const outboxFile = saveOutbox("discount", {
      to: toEmail,
      subject,
      discountRate,
      used: SMTP_HOST ? "smtp" : "jsonTransport",
      products: items.map((x) => ({ id: x?._id, name: x?.name, price: x?.price })),
      nodemailerInfo: info,
      at: new Date().toISOString(),
    });

    return { ok: true, outboxFile };
  } catch (err) {
    console.error("Failed to send discount email:", err?.message || err);
    return { ok: false, message: err?.message || "sendDiscountEmail failed" };
  }
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
    if (!to) return { ok: false, message: "Missing recipient" };

    const mailOptions = {
      from: SMTP_FROM || SMTP_USER || "no-reply@lastrada.local",
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

    const info = await transporter.sendMail(mailOptions);

    const outboxFile = saveOutbox("refund-approval", {
      to,
      subject: mailOptions.subject,
      returnId,
      orderId,
      refundedAmount,
      used: SMTP_HOST ? "smtp" : "jsonTransport",
      nodemailerInfo: info,
      at: new Date().toISOString(),
    });

    return { ok: true, outboxFile };
  } catch (err) {
    console.error("Failed to send refund approval email:", err?.message || err);
    return { ok: false, message: err?.message || "sendRefundApprovalEmail failed" };
  }
}
