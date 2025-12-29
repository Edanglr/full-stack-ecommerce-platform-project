// backend/src/utils/email.js
import "dotenv/config";
import nodemailer from "nodemailer";

/**
 * .env içinde tanımlanması gereken değişkenler:
 * SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

// Debug amaçlı: env gerçekten geliyor mu?
console.log("SMTP CONFIG =>", {
  host: SMTP_HOST,
  port: SMTP_PORT,
  user: SMTP_USER,
});

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

/**
 * Invoice mail
 * @param {Object} params
 * @param {string} params.to - Email gönderilecek kullanıcı
 * @param {string} params.pdfPath - PDF dosya path'i
 */
export async function sendInvoiceEmail({ to, pdfPath }) {
  try {
    if (!to) {
      throw new Error("Target email address (to) is required.");
    }

    const mailOptions = {
      from: SMTP_FROM || SMTP_USER,
      to,
      subject: "Your Order Invoice",
      text: "Thank you for your purchase! Your invoice is attached as a PDF file.",
      attachments: [
        {
          filename: pdfPath.split("/").pop(),
          path: pdfPath,
        },
      ],
    };

    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error("Failed to send invoice email:", err);
    throw err;
  }
}

/**
 * Discount notification mail (wishlist users)
 * @param {string} to
 * @param {string} name
 * @param {Array} products  [{name, price}]
 * @param {number} rate     0.20 -> %20
 */
export async function sendDiscountEmail(to, name, products, rate) {
  try {
    if (!to) return;

    const pct = Math.round(Number(rate) * 100);

    const productLines = (products || [])
      .slice(0, 10)
      .map((p) => `• ${p.name} — New Price: ${p.price} TL`)
      .join("\n");

    const mailOptions = {
      from: SMTP_FROM || SMTP_USER,
      to,
      subject: `Discount Alert: ${pct}% off on your wishlist items`,
      text: `Hi ${name || "Customer"},

Good news! A ${pct}% discount has been applied to some items in your wishlist.

${productLines}

La Strada`,
    };

    await transporter.sendMail(mailOptions);
  } catch (err) {
    // Discount email fail olursa sistemi kırmayalım
    console.error("Failed to send discount email:", err?.message || err);
  }
}
