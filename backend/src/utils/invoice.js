// backend/src/utils/invoice.js
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PDF'lerin kaydedileceği klasör
const INVOICE_DIR = path.join(__dirname, "..", "..", "invoices");

// Klasör yoksa oluştur
if (!fs.existsSync(INVOICE_DIR)) {
  fs.mkdirSync(INVOICE_DIR, { recursive: true });
}

/**
 * Belirtilen order + user için PDF invoice üretir.
 * Sonuç: { invoiceNumber, pdfPath }
 */
export function generateInvoicePdf({ order, user }) {
  return new Promise((resolve, reject) => {
    try {
      const baseId = (order._id || "").toString();
      const shortId = baseId.slice(-6);
      const datePart = new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");

      const invoiceNumber =
        order.invoiceNumber || `INV-${datePart}-${shortId || "000000"}`;

      const pdfPath = path.join(INVOICE_DIR, `invoice-${baseId}.pdf`);

      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const writeStream = fs.createWriteStream(pdfPath);

      writeStream.on("finish", () => {
        console.log("✅ Invoice PDF written:", pdfPath);
        resolve({ invoiceNumber, pdfPath });
      });

      writeStream.on("error", (err) => {
        console.error("✗ Invoice PDF write error:", err);
        reject(err);
      });

      doc.pipe(writeStream);

      // ====== HEADER ======
      doc.fontSize(20).text("La Strada - Invoice", { align: "center" });
      doc.moveDown();

      doc.fontSize(12);
      doc.text(`Invoice No: ${invoiceNumber}`);
      doc.text(`Order ID: ${baseId}`);
      if (order.trackingCode) {
        doc.text(`Tracking Code: ${order.trackingCode}`);
      }
      const created = order.createdAt
        ? new Date(order.createdAt)
        : new Date();
      doc.text(`Date: ${created.toLocaleString()}`);

      doc.moveDown();

      // ====== BILLING INFO ======
      const fullName =
        user?.name ||
        `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
        "Customer";

      doc.text("Bill To:");
      doc.text(fullName);

      const addr =
        user?.address || user?.shippingAddress || order.deliveryAddress || "";
      if (addr) doc.text(addr);

      const cityLine = [user?.city, user?.postalCode || user?.zip]
        .filter(Boolean)
        .join(" ");
      if (cityLine) doc.text(cityLine);

      doc.moveDown();

      // ====== ITEMS TABLE ======
      doc.text("Items:", { underline: true });
      doc.moveDown(0.5);

      const items = Array.isArray(order.items) ? order.items : [];

      if (items.length === 0) {
        doc.text("No items in this order.");
      } else {
        const tableTop = doc.y;
        const productX = 50;
        const qtyX = 300;
        const priceX = 360;
        const totalX = 430;

        doc.font("Helvetica-Bold");
        doc.text("Product", productX, tableTop);
        doc.text("Qty", qtyX, tableTop, { width: 40, align: "right" });
        doc.text("Price", priceX, tableTop, { width: 60, align: "right" });
        doc.text("Line Total", totalX, tableTop, {
          width: 80,
          align: "right",
        });

        doc.moveDown();
        doc.font("Helvetica");

        let position = tableTop + 20;

        items.forEach((item) => {
          const qty = item.quantity || 0;
          const price = item.price || 0;
          const lineTotal = qty * price;

          doc.text(
            item.name || item.productName || "Product",
            productX,
            position,
            { width: 230 }
          );
          doc.text(String(qty), qtyX, position, {
            width: 40,
            align: "right",
          });
          doc.text(
            price.toFixed ? price.toFixed(2) : price,
            priceX,
            position,
            { width: 60, align: "right" }
          );
          doc.text(
            lineTotal.toFixed(2),
            totalX,
            position,
            { width: 80, align: "right" }
          );

          position += 18;
        });

        // Üst çizgi
        doc.moveTo(productX, tableTop - 5)
          .lineTo(550, tableTop - 5)
          .stroke();
      }

      doc.moveDown();
      doc.moveDown();

      // ====== TOTAL ======
      const totalAmount =
        typeof order.totalAmount === "number" ? order.totalAmount : 0;

      doc.font("Helvetica-Bold");
      doc.text(`Total: ${totalAmount.toFixed(2)} TL`, {
        align: "right",
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
