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

  // Tarih bilgisini hazırla
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

  // Başlık
  doc
    .fontSize(20)
    .text("INVOICE", { align: "center" })
    .moveDown();

  // Invoice bilgileri
  doc
    .fontSize(12)
    .text(`Invoice Number: ${invoiceNumber}`)
    .text(`Invoice Date  : ${year}-${month}-${day}`)
    .moveDown();

  // Kullanıcı / fatura adresi
  const name = user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim();
  const address = user.address || user.shippingAddress || "";
  const city = user.city || "";
  const postalCode = user.postalCode || user.zip || "";

  doc
    .fontSize(12)
    .text("Bill To:", { underline: true })
    .moveDown(0.3)
    .text(name || "Customer")
    .text(address || "")
    .text(city || "")
    .text(postalCode || "")
    .moveDown();

  // Çizgi
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke().moveDown();

  // Ürün listesi başlıkları
  doc
    .fontSize(12)
    .text("Item", 50, doc.y + 10)
    .text("Size", 250, doc.y)
    .text("Qty", 320, doc.y, { width: 50, align: "right" })
    .text("Price", 380, doc.y, { width: 80, align: "right" })
    .text("Total", 470, doc.y, { width: 80, align: "right" })
    .moveDown();

  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

  // Ürün satırları
  const items = Array.isArray(order.items) ? order.items : [];
  let yPos = doc.y + 5;

  items.forEach((item) => {
    const nameText = item.name || item.productName || "Product";
    const sizeText = item.size || item.variant || "";
    const qty = item.quantity || 0;
    const price = item.price || 0;
    const lineTotal = qty * price;

    doc
      .fontSize(11)
      .text(nameText, 50, yPos, { width: 190 })
      .text(sizeText, 250, yPos, { width: 60 })
      .text(String(qty), 320, yPos, { width: 50, align: "right" })
      .text(price.toFixed(2), 380, yPos, { width: 80, align: "right" })
      .text(lineTotal.toFixed(2), 470, yPos, { width: 80, align: "right" });

    yPos += 18;

    // Sayfa sonu kontrolü (çok ürün olursa)
    if (yPos > 720) {
      doc.addPage();
      yPos = 50;
    }
  });

  doc.moveDown();

  // Toplam tutar
  const totalAmount =
    typeof order.totalAmount === "number" ? order.totalAmount : 0;

  doc
    .moveDown()
    .fontSize(12)
    .moveTo(50, doc.y)
    .lineTo(550, doc.y)
    .stroke()
    .moveDown()
    .fontSize(14)
    .text(`Total Amount: ${totalAmount.toFixed(2)}`, {
      align: "right",
    });

  doc.moveDown(2);
  doc
    .fontSize(10)
    .fillColor("gray")
    .text(
      "Thank you for your purchase!",
      { align: "center" }
    )
    .fillColor("black");

  // PDF'i bitir
  doc.end();

  // Yazma işlemi tamamlanınca Promise'i resolve et
  await new Promise((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });

  return { invoiceNumber, pdfPath };
}
