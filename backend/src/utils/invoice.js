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

  // ===================== HEADER =====================
  const brandName = "La Strada";
  const shopSubtitle = "Campus Shop";

  // La Strada ortada (sample_invoice gibi)
  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor("#111111")
    .text(brandName, { align: "center" });

  // Campus Shop bir alt satırda, solda küçük
  doc
    .moveDown(0.5)
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#555555")
    .text(shopSubtitle, 50);

  doc.moveDown(1);

  // Invoice info (sample_invoice’teki gibi solda blok halinde)
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#111111")
    .text(`Invoice Number: ${invoiceNumber}`)
    .text(`Invoice Date: ${year}-${month}-${day}`)
    .text(`Order ID: ${orderIdStr}`)
    .moveDown();

  // ===================== BILL TO =====================
  const name =
    user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim();
  const address = user.address || user.shippingAddress || "";
  const city = user.city || "";
  const postalCode = user.postalCode || user.zip || "";

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#111111")
    .text("Bill To");

  doc
    .moveDown(0.3)
    .font("Helvetica")
    .fontSize(11)
    .fillColor("#333333")
    .text(name || "Customer");

  if (address) doc.text(address);
  if (city) doc.text(city);
  if (postalCode) doc.text(postalCode);

  doc.moveDown(1.5);

  // ===================== ITEM TABLOSU =====================
  // Üst çizgi
  let tableTopY = doc.y;
  doc
    .moveTo(50, tableTopY)
    .lineTo(550, tableTopY)
    .lineWidth(0.8)
    .strokeColor("#000000")
    .stroke();

  // Başlık satırı
  const headerY = tableTopY + 8;

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#111111")
    .text("Item", 55, headerY, { width: 220 })
    .text("Size", 280, headerY, { width: 50 })
    .text("Qty", 340, headerY, { width: 40, align: "right" })
    .text("Price", 390, headerY, { width: 70, align: "right" })
    .text("Total", 470, headerY, { width: 70, align: "right" });

  // Başlık alt çizgisi
  const headerBottomY = headerY + 16;
  doc
    .moveTo(50, headerBottomY)
    .lineTo(550, headerBottomY)
    .lineWidth(0.5)
    .strokeColor("#000000")
    .stroke();

  // Satırlar
  const items = Array.isArray(order.items) ? order.items : [];
  let rowY = headerBottomY + 6;

  doc.font("Helvetica").fontSize(10).fillColor("#333333");

  for (const item of items) {
    const nameText = item.name || item.productName || "Product";
    const sizeText = item.size || item.variant || "";
    const qty = item.quantity || 0;
    const price = item.price || 0;
    const lineTotal = qty * price;

    doc
      .text(nameText, 55, rowY, { width: 220 })
      .text(sizeText, 280, rowY, { width: 50 })
      .text(String(qty), 340, rowY, { width: 40, align: "right" })
      .text(price.toFixed(2), 390, rowY, { width: 70, align: "right" })
      .text(lineTotal.toFixed(2), 470, rowY, { width: 70, align: "right" });

    rowY += 16;

    // Eğer çok ürün olursa sayfa taşmasın
    if (rowY > 720) {
      // satır alt çizgisi
      doc
        .moveTo(50, rowY)
        .lineTo(550, rowY)
        .lineWidth(0.5)
        .strokeColor("#000000")
        .stroke();

      doc.addPage();
      tableTopY = doc.y;
      doc
        .moveTo(50, tableTopY)
        .lineTo(550, tableTopY)
        .lineWidth(0.8)
        .strokeColor("#000000")
        .stroke();

      const newHeaderY = tableTopY + 8;

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#111111")
        .text("Item", 55, newHeaderY, { width: 220 })
        .text("Size", 280, newHeaderY, { width: 50 })
        .text("Qty", 340, newHeaderY, { width: 40, align: "right" })
        .text("Price", 390, newHeaderY, { width: 70, align: "right" })
        .text("Total", 470, newHeaderY, { width: 70, align: "right" });

      const newHeaderBottomY = newHeaderY + 16;
      doc
        .moveTo(50, newHeaderBottomY)
        .lineTo(550, newHeaderBottomY)
        .lineWidth(0.5)
        .strokeColor("#000000")
        .stroke();

      rowY = newHeaderBottomY + 6;
      doc.font("Helvetica").fontSize(10).fillColor("#333333");
    }
  }

  // Tablo alt çizgisi
  doc
    .moveTo(50, rowY + 4)
    .lineTo(550, rowY + 4)
    .lineWidth(0.8)
    .strokeColor("#000000")
    .stroke();

  // ===================== ORDER SUMMARY =====================
  const totalAmount =
    typeof order.totalAmount === "number" ? order.totalAmount : 0;

  doc.moveDown(2);

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#111111")
    .text("Order Summary");

  doc
    .moveDown(0.5)
    .font("Helvetica")
    .fontSize(11)
    .fillColor("#333333")
    .text(`Total Amount: ${totalAmount.toFixed(2)}`);

  doc.moveDown(2);

  // ===================== FOOTER =====================
  doc
    .font("Helvetica-Oblique")
    .fontSize(10)
    .fillColor("#555555")
    .text("Thank you for your purchase from La Strada.");

  doc
    .moveDown(0.3)
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#777777")
    .text(
      "This invoice was generated electronically and is valid without a signature."
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
