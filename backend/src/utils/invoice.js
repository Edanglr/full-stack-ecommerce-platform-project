// backend/src/utils/invoice.js

import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * PDF faturasını üretir ve kaydeder.
 * @param {Object} params
 * @param {Object} params.order - Order dokümanı
 * @param {Object} params.user  - User dokümanı
 * @returns {Promise<{ invoiceNumber: string, pdfPath: string }>}
 */
export async function generateInvoicePdf({ order, user }) {
  if (!order || !user) {
    throw new Error("Order and user are required to generate invoice.");
  }

  // invoices klasörünü backend kökünde oluştur (backend/invoices)
  const invoicesDir = path.join(__dirname, "..", "..", "invoices");
  if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
  }

  // Tarih bilgisi
  const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
  const year = createdAt.getFullYear();
  const month = String(createdAt.getMonth() + 1).padStart(2, "0");
  const day = String(createdAt.getDate()).padStart(2, "0");

  // Invoice number: INV-YYYYMMDD-<orderId ilk 6 hane>
  const orderIdStr = String(order._id || "");
  const orderIdShort = orderIdStr.slice(0, 6) || "000000";
  const invoiceNumber = `INV-${year}${month}${day}-${orderIdShort}`;

  // PDF dosya yolu: invoices/invoice-<orderId>.pdf
  const fileName = `invoice-${orderIdStr || Date.now()}.pdf`;
  const pdfPath = path.join(invoicesDir, fileName);

  // PDF oluşturma
  const doc = new PDFDocument({ margin: 50 });
  const writeStream = fs.createWriteStream(pdfPath);
  doc.pipe(writeStream);

  // ---------- HEADER ----------
  const brandName = "La Strada"; // istersen burayı değişebilirsin
  const shopSubtitle = "Campus Shop";

  doc
    .font("Helvetica-Bold")
    .fontSize(22)
    .fillColor("#111111")
    .text(brandName, 50, 40);

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#555555")
    .text(shopSubtitle, 50, 70);

  // Sağ tarafa invoice bilgileri
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#111111")
    .text(`Invoice Number: ${invoiceNumber}`, 320, 40, { align: "right" })
    .text(`Invoice Date: ${year}-${month}-${day}`, 320, 55, { align: "right" })
    .text(`Order ID: ${orderIdStr}`, 320, 70, { align: "right" });

  // Alt çizgi
  doc
    .moveTo(50, 95)
    .lineTo(550, 95)
    .lineWidth(1)
    .strokeColor("#dddddd")
    .stroke();

  // ---------- BILL TO BLOĞU ----------
  const name =
    user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim();
  const address = user.address || user.shippingAddress || "";
  const city = user.city || "";
  const postalCode = user.postalCode || user.zip || "";

  let y = 115;

  // Başlık için arka plan
  doc
    .rect(50, y, 500, 20)
    .fill("#f5f5f5");

  doc
    .fillColor("#111111")
    .font("Helvetica-Bold")
    .fontSize(12)
    .text("Bill To", 60, y + 5);

  y += 30;

  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor("#333333")
    .text(name || "Customer", 60, y);

  if (address) {
    doc.text(address, 60, doc.y);
  }
  if (city) {
    doc.text(city, 60, doc.y);
  }
  if (postalCode) {
    doc.text(postalCode, 60, doc.y);
  }

  // ---------- ITEM TABLOSU ----------
  y = doc.y + 25;

  // Tablo başlığı arka planı
  doc
    .rect(50, y, 500, 22)
    .fill("#f5f5f5");

  const tableHeaderY = y + 6;

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#111111")
    .text("Item", 55, tableHeaderY, { width: 200 })
    .text("Size", 260, tableHeaderY, { width: 60 })
    .text("Qty", 320, tableHeaderY, { width: 50, align: "right" })
    .text("Price", 380, tableHeaderY, { width: 80, align: "right" })
    .text("Total", 470, tableHeaderY, { width: 80, align: "right" });

  // Alt çizgi
  y += 22;
  doc
    .moveTo(50, y)
    .lineTo(550, y)
    .lineWidth(0.5)
    .strokeColor("#cccccc")
    .stroke();

  const items = Array.isArray(order.items) ? order.items : [];
  let rowY = y + 5;

  doc.font("Helvetica").fontSize(10).fillColor("#333333");

  for (const item of items) {
    const nameText = item.name || item.productName || "Product";
    const sizeText = item.size || item.variant || "";
    const qty = item.quantity || 0;
    const price = item.price || 0;
    const lineTotal = qty * price;

    // Satır
    doc
      .text(nameText, 55, rowY, { width: 200 })
      .text(sizeText, 260, rowY, { width: 60 })
      .text(String(qty), 320, rowY, { width: 50, align: "right" })
      .text(price.toFixed(2), 380, rowY, { width: 80, align: "right" })
      .text(lineTotal.toFixed(2), 470, rowY, { width: 80, align: "right" });

    rowY += 18;

    // Sayfa sonu kontrolü
    if (rowY > 720) {
      doc.addPage();
      rowY = 50;
    }
  }

  // Tablo alt çizgisi
  doc
    .moveTo(50, rowY + 2)
    .lineTo(550, rowY + 2)
    .lineWidth(0.5)
    .strokeColor("#cccccc")
    .stroke();

  // ---------- TOPLAM BLOĞU ----------
  const totalAmount =
    typeof order.totalAmount === "number" ? order.totalAmount : 0;

  const summaryTop = rowY + 20;

  // Sağda küçük bir özet kutusu
  const boxWidth = 200;
  const boxX = 350;

  doc
    .rect(boxX, summaryTop, boxWidth, 50)
    .lineWidth(0.5)
    .strokeColor("#cccccc")
    .stroke();

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#111111")
    .text("Order Summary", boxX + 10, summaryTop + 6);

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#333333")
    .text(
      `Total Amount: ${totalAmount.toFixed(2)}`,
      boxX + 10,
      summaryTop + 24
    );

  // ---------- FOOTER ----------
  const footerY = 760;

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#999999")
    .text(
      "Thank you for your purchase from La Strada.",
      50,
      footerY,
      { align: "center", width: 500 }
    );

  doc
    .fontSize(8)
    .text(
      "This invoice was generated electronically and is valid without a signature.",
      50,
      footerY + 12,
      { align: "center", width: 500 }
    );

  // PDF'i bitir
  doc.end();

  // Yazma işlemi tamamlanınca Promise'i resolve et
  await new Promise((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });

  return { invoiceNumber, pdfPath };
}
