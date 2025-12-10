// backend/src/utils/email.js

import "dotenv/config";
import nodemailer from "nodemailer";

/**
 * .env içinde tanımlanması gereken değişkenler:
 * SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
} = process.env;

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
  secure: false, // TLS için secure:false yeterli
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

/**
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
    // Burada throw bırakıyoruz; orderRoutes içinde try/catch zaten yakalıyor.
    throw err;
  }
}
