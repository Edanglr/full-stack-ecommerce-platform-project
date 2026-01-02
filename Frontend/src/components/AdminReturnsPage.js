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

function badgeStyle(status) {
  const s = String(status || "").toLowerCase();
  if (s === "requested") return { background: "#fff3cd", color: "#856404" };
  if (s === "approved") return { background: "#d4edda", color: "#155724" };
  if (s === "received") return { background: "#d1ecf1", color: "#0c5460" };
  if (s === "refunded") return { background: "#e2e3ff", color: "#2f2f77" };
  if (s === "rejected") return { background: "#f8d7da", color: "#721c24" };
  if (s === "completed") return { background: "#e6f4ea", color: "#1e7e34" };
  if (s === "cancelled") return { background: "#eee", color: "#111" };
  return { background: "#eee", color: "#111" };
}

export default function AdminReturnsPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [returns, setReturns] = useState([]);

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);

  const loadReturns = async () => {
    try {
      setErr("");
      setMsg("");
      setLoading(true);
      const data = await apiFetch("/api/returns");
      setReturns(Array.isArray(data) ? data : []);
    } catch (e) {
      setReturns([]);
      setErr(e.message || "Failed to load returns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReturns();
  }, []);

  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();

    return (returns || []).filter((r) => {
      if (statusFilter !== "all" && String(r.status) !== String(statusFilter)) return false;

      if (!q) return true;

      const fields = [
        r?._id,
        r?.order?._id,
        r?.product?._id,
        r?.product?.name,
        r?.user?.name,
        r?.user?.email,
        r?.reason,
        r?.size,
        String(r?.quantity ?? ""),
        String(r?.status ?? ""),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return fields.includes(q);
    });
  }, [returns, statusFilter, search]);

  const refreshAndSyncModal = async (returnIdToSync) => {
    await loadReturns();
    if (!returnIdToSync) return;
    const found = (returns || []).find((x) => String(x._id) === String(returnIdToSync));
    if (found) setActive(found);
  };

  const approveRefund = async (returnId) => {
    try {
      setErr("");
      setMsg("");
      const ok = window.confirm("Approve this return? This calculates refund amount and emails the customer.");
      if (!ok) return;

      setLoading(true);
      const data = await apiFetch(`/api/returns/${returnId}/approve`, { method: "PATCH" });

      setMsg(data?.message || "Approved.");
      await loadReturns();
      if (open && active && String(active._id) === String(returnId)) {
        const fresh = await apiFetch("/api/returns");
        const found = (Array.isArray(fresh) ? fresh : []).find((x) => String(x._id) === String(returnId));
        if (found) setActive(found);
      }
    } catch (e) {
      setErr(e.message || "Approve failed");
    } finally {
      setLoading(false);
    }
  };

  const rejectReturn = async (returnId) => {
    try {
      setErr("");
      setMsg("");
      const rejectReason = window.prompt("Reject reason (optional):", "");
      const ok = window.confirm("Reject this return request?");
      if (!ok) return;

      setLoading(true);
      const data = await apiFetch(`/api/returns/${returnId}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ reason: rejectReason || "" }),
      });

      setMsg(data?.message || "Rejected.");
      await loadReturns();
      if (open && active && String(active._id) === String(returnId)) {
        const fresh = await apiFetch("/api/returns");
        const found = (Array.isArray(fresh) ? fresh : []).find((x) => String(x._id) === String(returnId));
        if (found) setActive(found);
      }
    } catch (e) {
      setErr(e.message || "Reject failed");
    } finally {
      setLoading(false);
    }
  };

  const markReceived = async (returnId) => {
    try {
      setErr("");
      setMsg("");
      const ok = window.confirm("Mark as received? This means the item arrived to warehouse.");
      if (!ok) return;

      setLoading(true);
      const data = await apiFetch(`/api/returns/${returnId}/received`, { method: "PATCH" });

      setMsg(data?.message || "Marked as received.");
      await loadReturns();
      if (open && active && String(active._id) === String(returnId)) {
        const fresh = await apiFetch("/api/returns");
        const found = (Array.isArray(fresh) ? fresh : []).find((x) => String(x._id) === String(returnId));
        if (found) setActive(found);
      }
    } catch (e) {
      setErr(e.message || "Received update failed");
    } finally {
      setLoading(false);
    }
  };

  const markRefunded = async (returnId) => {
    try {
      setErr("");
      setMsg("");
      const ok = window.confirm("Mark as refunded? This means money transfer is done.");
      if (!ok) return;

      setLoading(true);
      const data = await apiFetch(`/api/returns/${returnId}/refund`, { method: "PATCH" });

      setMsg(data?.message || "Marked as refunded.");
      await loadReturns();
      if (open && active && String(active._id) === String(returnId)) {
        const fresh = await apiFetch("/api/returns");
        const found = (Array.isArray(fresh) ? fresh : []).find((x) => String(x._id) === String(returnId));
        if (found) setActive(found);
      }
    } catch (e) {
      setErr(e.message || "Refund update failed");
    } finally {
      setLoading(false);
    }
  };

  const markCompleted = async (returnId) => {
    try {
      setErr("");
      setMsg("");
      const ok = window.confirm("Complete the return flow?");
      if (!ok) return;

      setLoading(true);
      const data = await apiFetch(`/api/returns/${returnId}/complete`, { method: "PATCH" });

      setMsg(data?.message || "Completed.");
      await loadReturns();
      if (open && active && String(active._id) === String(returnId)) {
        const fresh = await apiFetch("/api/returns");
        const found = (Array.isArray(fresh) ? fresh : []).find((x) => String(x._id) === String(returnId));
        if (found) setActive(found);
      }
    } catch (e) {
      setErr(e.message || "Complete failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "92px 18px 22px 18px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Return Requests (Sales Manager)</h2>
        <button
          onClick={loadReturns}
          disabled={loading}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "white",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 600,
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
          <div style={{ fontWeight: 700 }}>Status:</div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ccc" }}
          >
            <option value="all">All</option>
            <option value="Requested">Requested</option>
            <option value="Approved">Approved</option>
            <option value="Received">Received</option>
            <option value="Refunded">Refunded</option>
            <option value="Rejected">Rejected</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 700 }}>Search:</div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="order id, product, user email, reason..."
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ccc", width: "100%" }}
          />
        </div>

        <div style={{ fontWeight: 600, opacity: 0.8 }}>
          Showing: {filtered.length} / {returns.length}
        </div>
      </div>

      <div style={{ marginTop: 12, background: "white", border: "1px solid #eee", borderRadius: 10, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
              {["Created", "Return ID", "Customer", "Order", "Product", "Size", "Qty", "Status", "Refund(TL)", "Actions"].map(
                (h) => (
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
                )
              )}
            </tr>
          </thead>

          <tbody>
            {filtered.map((r) => {
              const st = String(r.status || "");
              const canApprove = st === "Requested";
              const canReject = st === "Requested";
              const canReceived = st === "Approved";
              const canRefund = st === "Received";
              const canComplete = st === "Refunded";

              return (
                <tr key={r._id} style={{ borderBottom: "1px solid #f2f2f2" }}>
                  <td style={{ padding: "10px 10px", fontSize: 13 }}>{formatDateTime(r.createdAt)}</td>

                  <td style={{ padding: "10px 10px", fontSize: 13 }}>
                    <button
                      onClick={() => {
                        setActive(r);
                        setOpen(true);
                      }}
                      style={{
                        padding: 0,
                        border: "none",
                        background: "none",
                        textDecoration: "underline",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      {String(r._id).slice(-8)}
                    </button>
                  </td>

                  <td style={{ padding: "10px 10px", fontSize: 13 }}>
                    <div style={{ fontWeight: 700 }}>{r.user?.name || "Unknown"}</div>
                    <div style={{ opacity: 0.8 }}>{r.user?.email || ""}</div>
                  </td>

                  <td style={{ padding: "10px 10px", fontSize: 13 }}>
                    {r.order?._id ? String(r.order._id).slice(-8) : ""}
                  </td>

                  <td style={{ padding: "10px 10px", fontSize: 13 }}>
                    <div style={{ fontWeight: 700 }}>{r.product?.name || "Product"}</div>
                    <div style={{ opacity: 0.75 }}>{r.reason || ""}</div>
                  </td>

                  <td style={{ padding: "10px 10px", fontSize: 13 }}>{r.size || "-"}</td>
                  <td style={{ padding: "10px 10px", fontSize: 13 }}>{r.quantity ?? 1}</td>

                  <td style={{ padding: "10px 10px", fontSize: 13 }}>
                    <span
                      style={{
                        ...badgeStyle(r.status),
                        padding: "4px 8px",
                        borderRadius: 999,
                        fontWeight: 700,
                        fontSize: 12,
                      }}
                    >
                      {r.status}
                    </span>
                  </td>

                  <td style={{ padding: "10px 10px", fontSize: 13 }}>
                    {typeof r.refundedAmount === "number" ? r.refundedAmount.toFixed(2) : "-"}
                  </td>

                  <td style={{ padding: "10px 10px", fontSize: 13 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        disabled={!canApprove || loading}
                        onClick={() => approveRefund(r._id)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #222",
                          background: canApprove ? "#222" : "#eee",
                          color: canApprove ? "white" : "#666",
                          cursor: canApprove && !loading ? "pointer" : "not-allowed",
                          fontWeight: 700,
                        }}
                      >
                        Approve
                      </button>

                      <button
                        disabled={!canReject || loading}
                        onClick={() => rejectReturn(r._id)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #ccc",
                          background: "white",
                          color: canReject ? "#111" : "#999",
                          cursor: canReject && !loading ? "pointer" : "not-allowed",
                          fontWeight: 700,
                        }}
                      >
                        Reject
                      </button>

                      <button
                        disabled={!canReceived || loading}
                        onClick={() => markReceived(r._id)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #ccc",
                          background: canReceived ? "white" : "#eee",
                          color: canReceived ? "#111" : "#999",
                          cursor: canReceived && !loading ? "pointer" : "not-allowed",
                          fontWeight: 700,
                        }}
                      >
                        Received
                      </button>

                      <button
                        disabled={!canRefund || loading}
                        onClick={() => markRefunded(r._id)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #ccc",
                          background: canRefund ? "white" : "#eee",
                          color: canRefund ? "#111" : "#999",
                          cursor: canRefund && !loading ? "pointer" : "not-allowed",
                          fontWeight: 700,
                        }}
                      >
                        Refunded
                      </button>

                      <button
                        disabled={!canComplete || loading}
                        onClick={() => markCompleted(r._id)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #ccc",
                          background: canComplete ? "white" : "#eee",
                          color: canComplete ? "#111" : "#999",
                          cursor: canComplete && !loading ? "pointer" : "not-allowed",
                          fontWeight: 700,
                        }}
                      >
                        Complete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {!filtered.length && (
              <tr>
                <td colSpan={10} style={{ padding: 14, textAlign: "center", opacity: 0.75 }}>
                  No return requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && active && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 12,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(720px, 100%)",
              background: "white",
              borderRadius: 12,
              padding: 14,
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Return Details</div>
              <button
                onClick={() => setOpen(false)}
                style={{ border: "1px solid #ccc", background: "white", borderRadius: 8, padding: "6px 10px" }}
              >
                Close
              </button>
            </div>

            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><b>Return ID:</b> {active._id}</div>
              <div><b>Created:</b> {formatDateTime(active.createdAt)}</div>

              <div><b>Customer:</b> {active.user?.name || "Unknown"}</div>
              <div><b>Email:</b> {active.user?.email || ""}</div>

              <div><b>Order:</b> {active.order?._id || ""}</div>
              <div><b>Order Status:</b> {active.order?.shippingStatus || ""}</div>

              <div><b>Product:</b> {active.product?.name || ""}</div>
              <div><b>Product ID:</b> {active.product?._id || ""}</div>

              <div><b>Size:</b> {active.size || "-"}</div>
              <div><b>Quantity:</b> {active.quantity ?? 1}</div>

              <div style={{ gridColumn: "1 / -1" }}><b>Reason:</b> {active.reason || ""}</div>

              <div><b>Status:</b> {active.status}</div>
              <div><b>Refunded Amount:</b> {typeof active.refundedAmount === "number" ? active.refundedAmount.toFixed(2) : "-"}</div>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                disabled={String(active.status) !== "Requested" || loading}
                onClick={() => approveRefund(active._id)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #222",
                  background: "#222",
                  color: "white",
                  fontWeight: 800,
                  cursor: String(active.status) === "Requested" && !loading ? "pointer" : "not-allowed",
                }}
              >
                Approve
              </button>

              <button
                disabled={String(active.status) !== "Requested" || loading}
                onClick={() => rejectReturn(active._id)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  background: "white",
                  fontWeight: 800,
                  cursor: String(active.status) === "Requested" && !loading ? "pointer" : "not-allowed",
                }}
              >
                Reject
              </button>

              <button
                disabled={String(active.status) !== "Approved" || loading}
                onClick={() => markReceived(active._id)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  background: "white",
                  fontWeight: 800,
                  cursor: String(active.status) === "Approved" && !loading ? "pointer" : "not-allowed",
                }}
              >
                Received
              </button>

              <button
                disabled={String(active.status) !== "Received" || loading}
                onClick={() => markRefunded(active._id)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  background: "white",
                  fontWeight: 800,
                  cursor: String(active.status) === "Received" && !loading ? "pointer" : "not-allowed",
                }}
              >
                Refunded
              </button>

              <button
                disabled={String(active.status) !== "Refunded" || loading}
                onClick={() => markCompleted(active._id)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  background: "white",
                  fontWeight: 800,
                  cursor: String(active.status) === "Refunded" && !loading ? "pointer" : "not-allowed",
                }}
              >
                Complete
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Status History</div>
              <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
                {(active.statusHistory || []).length === 0 ? (
                  <div style={{ opacity: 0.75 }}>No history</div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {(active.statusHistory || [])
                      .slice()
                      .reverse()
                      .map((h, idx) => (
                        <div key={idx} style={{ fontSize: 13 }}>
                          <div style={{ fontWeight: 800 }}>
                            {h.status} <span style={{ fontWeight: 500, opacity: 0.75 }}>{formatDateTime(h.at)}</span>
                          </div>
                          {h.note ? <div style={{ opacity: 0.85 }}>{h.note}</div> : null}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
