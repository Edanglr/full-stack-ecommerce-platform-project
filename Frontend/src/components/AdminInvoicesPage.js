import React from "react";
import AdminOrdersPage from "./AdminOrdersPage";

export default function AdminInvoicesPage() {
  // Sales Manager paneli zaten AdminOrdersPage içinde var.
  // Bu sayfa sadece Invoices tabını açan bir wrapper.
  return <AdminOrdersPage initialTab="invoices" />;
}
