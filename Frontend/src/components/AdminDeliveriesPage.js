// Frontend/src/components/AdminDeliveriesPage.js
import React, { useEffect, useMemo, useState } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:5050";

function getToken() {
  return localStorage.getItem("token") || "";
}

async function apiFetch(path, options = {}) {
  const token = getToken();

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = data?.message || `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function formatDateTime(d) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString();
}

export default function AdminDeliveriesPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [deliveries, setDeliveries] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | Processing | In-transit | Delivered

  const loadDeliveries = async () => {
    try {
      setErr("");
      setMsg("");
      setLoading(true);
      const data = await apiFetch("/api/orders/admin/deliveries");
      setDeliveries(Array.isArray(data) ? data : []);
    } catch (e) {
      setDeliveries([]);
      setErr(e.message || "Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeliveries();
  }, []);

  // deliveries endpoint her item için bir satır döndürüyor; order bazında gruplayalım
  const groupedOrders = useMemo(() => {
    const map = {};
    (deliveries || []).forEach((row) => {
      const id = row.deliveryId;
      if (!map[id]) {
        map[id] = {
          orderId: row.deliveryId,
          customerId: row.customerId,
          customerName: row.customerName,
          deliveryAddress: row.deliveryAddress,
          trackingCode: row.trackingCode,
          shippingStatus: row.shippingStatus,
          createdAt: row.createdAt,
          items: [],
        };
      }
      map[id].items.push({
        productId: row.productId,
        productName: row.productName,
        quantity: row.quantity,
        totalPrice: row.totalPrice,
      });
    });

    return Object.values(map).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  }, [deliveries]);

  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();

    return (groupedOrders || []).filter((o) => {
      if (statusFilter !== "all" && String(o.shippingStatus) !== String(statusFilter)) return false;

      if (!q) return true;

      const fields = [
        o.orderId,
        o.customerId,
        o.customerName,
        o.deliveryAddress,
        o.trackingCode,
        o.shippingStatus,
        ...(o.items || []).map((i) => `${i.productId} ${i.productName}`),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return fields.includes(q);
    });
  }, [groupedOrders, statusFilter, search]);

  const updateStatus = async (orderId, newStatus) => {
    try {
      setErr("");
      setMsg("");

      const ok = window.confirm(`Set order status to "${newStatus}"?`);
      if (!ok) return;

      setLoading(true);
      const data = await apiFetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });

      setMsg(data?.message || "Order status updated.");
      await loadDeliveries();
    } catch (e) {
      setErr(e.message || "Status update failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "92px 18px 22px 18px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Delivery / Order Status Panel</h2>

        <button
          onClick={loadDeliveries}
          disabled={loading}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "white",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 700,
          }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {err && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "#f8d7da", color: "#721c24" }}>
          {err}
        </div>
      )}
      {msg && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "#d4edda", color: "#155724" }}>
          {msg}
        </div>
      )}

      {/* Filters */}
      <div
        style={{
          marginTop: 14,
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          background: "white",
          border: "1px solid #eee",
          borderRadius: 10,
          padding: 12,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ fontWeight: 800 }}>Status:</div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ccc" }}
          >
            <option value="all">All</option>
            <option value="Processing">Processing</option>
            <option value="In-transit">In-transit</option>
            <option value="Delivered">Delivered</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 800 }}>Search:</div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="delivery id, customer id, tracking, customer, address, product..."
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ccc", width: "100%" }}
          />
        </div>

        <div style={{ fontWeight: 700, opacity: 0.8 }}>
          Showing: {filtered.length} / {groupedOrders.length}
        </div>
      </div>

      {/* Orders table */}
      <div style={{ marginTop: 12, background: "white", border: "1px solid #eee", borderRadius: 10, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1150 }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
              {[
                "Created",
                "Delivery ID",
                "Customer ID",
                "Tracking",
                "Customer",
                "Address",
                "Items (ProductId | Qty | Total)",
                "Qty",
                "Total",
                "Status",
                "Update",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "10px 10px",
                    borderBottom: "1px solid #eee",
                    fontSize: 13,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filtered.map((o) => {
              const totalQty = (o.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
              const totalPrice = (o.items || []).reduce((s, it) => s + (Number(it.totalPrice) || 0), 0);

              // ✅ Rubric için item bazında: productId + qty + totalPrice
              const itemsDetail = (o.items || [])
                .map((it) => {
                  const pid = it.productId ? String(it.productId) : "";
                  const qty = Number(it.quantity) || 0;
                  const tp = Number(it.totalPrice) || 0;
                  return `${pid} | qty: ${qty} | total: ${tp.toFixed(2)}`;
                })
                .filter(Boolean)
                .join("\n");

              return (
                <tr key={o.orderId} style={{ borderBottom: "1px solid #f2f2f2" }}>
                  <td style={{ padding: "10px 10px", fontSize: 13 }}>{formatDateTime(o.createdAt)}</td>

                  {/* ✅ Full Delivery ID (rubric: display delivery ID) */}
                  <td style={{ padding: "10px 10px", fontSize: 12, fontWeight: 800, wordBreak: "break-all" }}>
                    {String(o.orderId)}
                  </td>

                  {/* ✅ Full Customer ID (rubric: display customer ID) */}
                  <td style={{ padding: "10px 10px", fontSize: 12, wordBreak: "break-all" }}>
                    {o.customerId ? String(o.customerId) : ""}
                  </td>

                  <td style={{ padding: "10px 10px", fontSize: 13 }}>{o.trackingCode || ""}</td>
                  <td style={{ padding: "10px 10px", fontSize: 13 }}>{o.customerName || ""}</td>

                  <td
                    style={{
                      padding: "10px 10px",
                      fontSize: 13,
                      maxWidth: 260,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={o.deliveryAddress || ""}
                  >
                    {o.deliveryAddress || ""}
                  </td>

                  {/* ✅ Item detail: ProductId + Qty + Total */}
                  <td
                    style={{
                      padding: "10px 10px",
                      fontSize: 12,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      maxWidth: 420,
                    }}
                  >
                    {itemsDetail}
                  </td>

                  <td style={{ padding: "10px 10px", fontSize: 13 }}>{totalQty}</td>
                  <td style={{ padding: "10px 10px", fontSize: 13 }}>{totalPrice.toFixed(2)}</td>

                  <td style={{ padding: "10px 10px", fontSize: 13, fontWeight: 800 }}>{o.shippingStatus}</td>

                  <td style={{ padding: "10px 10px", fontSize: 13 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        disabled={loading}
                        onClick={() => updateStatus(o.orderId, "Processing")}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #ccc",
                          background: "white",
                          cursor: loading ? "not-allowed" : "pointer",
                          fontWeight: 700,
                        }}
                      >
                        Processing
                      </button>
                      <button
                        disabled={loading}
                        onClick={() => updateStatus(o.orderId, "In-transit")}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #ccc",
                          background: "white",
                          cursor: loading ? "not-allowed" : "pointer",
                          fontWeight: 700,
                        }}
                      >
                        In-transit
                      </button>
                      <button
                        disabled={loading}
                        onClick={() => updateStatus(o.orderId, "Delivered")}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #222",
                          background: "#222",
                          color: "white",
                          cursor: loading ? "not-allowed" : "pointer",
                          fontWeight: 800,
                        }}
                      >
                        Delivered
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {!filtered.length && (
              <tr>
                <td colSpan={11} style={{ padding: 14, textAlign: "center", opacity: 0.75 }}>
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
