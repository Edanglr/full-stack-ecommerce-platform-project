import React from "react";
import AdminOrdersPage from "./AdminOrdersPage";

export default function SalesAnalyticsPage() {
  // Sales Manager paneli zaten AdminOrdersPage içinde var.
  // Bu sayfa sadece Analytics tabını açan bir wrapper.
  return <AdminOrdersPage initialTab="analytics" />;
}
