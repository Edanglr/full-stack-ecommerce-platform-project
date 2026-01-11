// Frontend/src/components/AdminOrdersPage.js
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

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function LineChart({
  data,
  width = 920,
  height = 240,
  valueKey = "profit",
  title = "Profit Chart",
}) {
  const padding = 30;
  const W = width;
  const H = height;

  const safe = Array.isArray(data) ? data : [];
  if (!safe.length) return null;

  const vals = safe.map((d) => Number(d?.[valueKey] ?? 0));
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);

  const xStep = safe.length > 1 ? (W - padding * 2) / (safe.length - 1) : 0;

  const scaleY = (v) => {
    if (maxV === minV) return H / 2;
    return (
      H -
      padding -
      ((v - minV) / (maxV - minV)) * (H - padding * 2)
    );
  };

  const points = safe
    .map((d, i) => {
      const x = padding + i * xStep;
      const y = scaleY(Number(d?.[valueKey] ?? 0));
      return `${x},${y}`;
    })
    .join(" ");

  const labelIdx = [
    0,
    Math.floor((safe.length - 1) / 2),
    safe.length - 1,
  ].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 10,
        padding: 12,
        background: "white",
        marginBottom: 12,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>

      <svg
        width={W}
        height={H}
        style={{ display: "block", width: "100%", overflow: "visible" }}
      >
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={H - padding}
          stroke="black"
          strokeWidth="1"
        />
        <line
          x1={padding}
          y1={H - padding}
          x2={W - padding}
          y2={H - padding}
          stroke="black"
          strokeWidth="1"
        />

        <polyline fill="none" stroke="black" strokeWidth="2" points={points} />

        <text x={padding + 6} y={padding + 10} fontSize="12">{`max: ${maxV.toFixed(
          2
        )}`}</text>
        <text
          x={padding + 6}
          y={H - padding - 6}
          fontSize="12"
        >{`min: ${minV.toFixed(2)}`}</text>

        {labelIdx.map((i) => (
          <text
            key={i}
            x={padding + i * xStep}
            y={H - padding + 18}
            fontSize="12"
            textAnchor="middle"
          >
            {safe[i]?.date}
          </text>
        ))}
      </svg>
    </div>
  );
}

export default function AdminOrdersPage({ initialTab = "invoices" }) {
  const [tab, setTab] = useState(initialTab);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayISO());

  const [invoices, setInvoices] = useState([]);
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState("");

  const [products, setProducts] = useState([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodError, setProdError] = useState("");

  const [selectedIds, setSelectedIds] = useState([]);
  const [discountRate, setDiscountRate] = useState("0.20");
  const [discMsg, setDiscMsg] = useState("");
  const [discErr, setDiscErr] = useState("");
  const [discLoading, setDiscLoading] = useState(false);

  const [priceEdits, setPriceEdits] = useState({});
  const [priceMsg, setPriceMsg] = useState("");
  const [priceErr, setPriceErr] = useState("");
  const [priceLoading, setPriceLoading] = useState(false);

  const [analytics, setAnalytics] = useState(null);
  const [anLoading, setAnLoading] = useState(false);
  const [anError, setAnError] = useState("");

  const loadInvoices = async () => {
    try {
      setInvError("");
      setInvLoading(true);
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      const data = await apiFetch(`/api/sales/invoices?${qs.toString()}`);
      setInvoices(Array.isArray(data) ? data : []);
    } catch (e) {
      setInvoices([]);
      setInvError(e.message || "Invoices fetch failed");
    } finally {
      setInvLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      setProdError("");
      setProdLoading(true);
      const data = await apiFetch("/api/products");
      setProducts(Array.isArray(data) ? data : []);
    } catch (e) {
      setProducts([]);
      setProdError(e.message || "Products fetch failed");
    } finally {
      setProdLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      setAnError("");
      setAnLoading(true);
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      const data = await apiFetch(`/api/sales/analytics?${qs.toString()}`);
      setAnalytics(data || null);
    } catch (e) {
      setAnalytics(null);
      setAnError(e.message || "Analytics fetch failed");
    } finally {
      setAnLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Eğer /admin/analytics gibi bir route üzerinden bu sayfaya geldiysek,
  // ilk açılışta analytics verisini de otomatik çek.
  useEffect(() => {
    if (initialTab === "analytics") {
      loadAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    return (invoices || []).map((o) => ({
      invoiceId: o._id,
      customer: o.user?.name || o.user?.email || "Unknown",
      total: Number(o.totalAmount ?? 0),
      status: o.shippingStatus || "",
      tracking: o.trackingCode || "",
      createdAt: o.createdAt,
    }));
  }, [invoices]);

  const toggleSelected = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const applyDiscount = async () => {
    try {
      setDiscMsg("");
      setDiscErr("");
      setDiscLoading(true);

      const rate = Number(discountRate);
      if (!(rate > 0 && rate < 1)) {
        throw new Error("discountRate must be like 0.10, 0.20, 0.25");
      }
      if (!selectedIds.length) {
        throw new Error("Select at least 1 product");
      }

      const data = await apiFetch("/api/sales/discount", {
        method: "POST",
        body: JSON.stringify({
          productIds: selectedIds,
          discountRate: rate,
        }),
      });

      setDiscMsg(
        `✅ Discount applied. Updated: ${data.updatedCount}, Notified users: ${data.notifiedUsers}`
      );

      await loadProducts();
      await loadInvoices();
    } catch (e) {
      setDiscErr(e.message || "Discount failed");
    } finally {
      setDiscLoading(false);
    }
  };

  const savePrices = async () => {
    try {
      setPriceMsg("");
      setPriceErr("");
      setPriceLoading(true);

      const updates = Object.entries(priceEdits)
        .map(([productId, val]) => ({ productId, newPrice: Number(val) }))
        .filter((x) => x.productId && x.newPrice > 0);

      if (!updates.length) throw new Error("Enter at least 1 valid price.");

      const data = await apiFetch("/api/sales/prices", {
        method: "PUT",
        body: JSON.stringify({ updates }),
      });

      setPriceMsg(`✅ ${data.updatedCount} products updated.`);
      setPriceEdits({});
      await loadProducts();
    } catch (e) {
      setPriceErr(e.message || "Price update failed");
    } finally {
      setPriceLoading(false);
    }
  };

  const printTable = () => {
    window.print();
  };

  return (
    <div style={{ paddingTop: 90, maxWidth: 1100, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 6 }}>Sales Manager Panel</h2>
      <div style={{ opacity: 0.8, marginBottom: 14 }}>
        Invoices, discounts, prices, and analytics (date range).
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <button
          onClick={() => setTab("invoices")}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: tab === "invoices" ? "#eee" : "white",
            cursor: "pointer",
          }}
        >
          Invoices
        </button>
        <button
          onClick={() => setTab("discount")}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: tab === "discount" ? "#eee" : "white",
            cursor: "pointer",
          }}
        >
          Discounts
        </button>
        <button
          onClick={() => setTab("prices")}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: tab === "prices" ? "#eee" : "white",
            cursor: "pointer",
          }}
        >
          Prices
        </button>
        <button
          onClick={() => setTab("analytics")}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: tab === "analytics" ? "#eee" : "white",
            cursor: "pointer",
          }}
        >
          Analytics
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 16,
          padding: 12,
          border: "1px solid #e5e5e5",
          borderRadius: 10,
          background: "white",
        }}
      >
        <div style={{ fontWeight: 600 }}>Date Range:</div>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>

        <button
          onClick={async () => {
            if (tab === "invoices") await loadInvoices();
            if (tab === "analytics") await loadAnalytics();
          }}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "white",
            cursor: "pointer",
          }}
        >
          Apply
        </button>

        {tab === "invoices" && (
          <button
            onClick={printTable}
            style={{
              marginLeft: "auto",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: "white",
              cursor: "pointer",
            }}
          >
            Print / Save PDF
          </button>
        )}
      </div>

      {/* INVOICES TAB */}
      {tab === "invoices" && (
        <div>
          <h3 style={{ marginBottom: 8 }}>Invoices</h3>

          {invLoading && (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p style={{ marginTop: "10px" }}>Loading invoices...</p>
            </div>
          )}

          {invError && (
            <div
              style={{
                padding: "15px",
                marginBottom: "20px",
                backgroundColor: "#fee",
                border: "1px solid #fcc",
                borderRadius: "8px",
                color: "#c33",
              }}
            >
              <strong>Error:</strong> {invError}
            </div>
          )}

          {!invLoading && !invError && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                    <th style={{ padding: 10 }}>Invoice ID</th>
                    <th style={{ padding: 10 }}>Customer</th>
                    <th style={{ padding: 10 }}>Total</th>
                    <th style={{ padding: 10 }}>Status</th>
                    <th style={{ padding: 10 }}>Tracking</th>
                    <th style={{ padding: 10 }}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.invoiceId} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: 10 }}>{r.invoiceId}</td>
                      <td style={{ padding: 10 }}>{r.customer}</td>
                      <td style={{ padding: 10 }}>{r.total.toFixed(2)} TL</td>
                      <td style={{ padding: 10 }}>{r.status}</td>
                      <td style={{ padding: 10 }}>{r.tracking}</td>
                      <td style={{ padding: 10 }}>{formatDateTime(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!rows.length && (
                <div
                  style={{
                    padding: "40px",
                    textAlign: "center",
                    backgroundColor: "#f9f9f9",
                    borderRadius: "8px",
                    border: "1px solid #e5e5e5",
                    marginTop: "10px",
                  }}
                >
                  <p style={{ fontSize: "16px", color: "#666" }}>
                    No invoices in selected range.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* DISCOUNTS TAB */}
      {tab === "discount" && (
        <div>
          <h3 style={{ marginBottom: 8 }}>Apply Discount to Selected Products</h3>

          {prodLoading && (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p style={{ marginTop: "10px" }}>Loading products...</p>
            </div>
          )}

          {prodError && (
            <div
              style={{
                padding: "15px",
                marginBottom: "20px",
                backgroundColor: "#fee",
                border: "1px solid #fcc",
                borderRadius: "8px",
                color: "#c33",
              }}
            >
              <strong>Error:</strong> {prodError}
            </div>
          )}

          {!prodLoading && !prodError && (
            <>
              <div style={{ marginBottom: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  Discount Rate (0.20 = 20%)
                  <input
                    value={discountRate}
                    onChange={(e) => setDiscountRate(e.target.value)}
                    style={{ width: 120 }}
                  />
                </label>
                <button
                  onClick={applyDiscount}
                  disabled={discLoading}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #ccc",
                    background: "white",
                    cursor: discLoading ? "not-allowed" : "pointer",
                    opacity: discLoading ? 0.6 : 1,
                  }}
                >
                  {discLoading ? "Applying..." : "Apply Discount"}
                </button>
              </div>

              {discMsg && (
                <div
                  style={{
                    padding: "12px",
                    marginBottom: "10px",
                    backgroundColor: "#d4edda",
                    border: "1px solid #c3e6cb",
                    borderRadius: "8px",
                    color: "#155724",
                  }}
                >
                  {discMsg}
                </div>
              )}

              {discErr && (
                <div
                  style={{
                    padding: "12px",
                    marginBottom: "10px",
                    backgroundColor: "#fee",
                    border: "1px solid #fcc",
                    borderRadius: "8px",
                    color: "#c33",
                  }}
                >
                  <strong>Error:</strong> {discErr}
                </div>
              )}

              <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                      <th style={{ padding: 10 }}>Select</th>
                      <th style={{ padding: 10 }}>Name</th>
                      <th style={{ padding: 10 }}>Category</th>
                      <th style={{ padding: 10 }}>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p._id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <td style={{ padding: 10 }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(p._id)}
                            onChange={() => toggleSelected(p._id)}
                          />
                        </td>
                        <td style={{ padding: 10 }}>{p.name}</td>
                        <td style={{ padding: 10 }}>{p.category}</td>
                        <td style={{ padding: 10 }}>{Number(p.price ?? 0).toFixed(2)} TL</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!products.length && (
                  <div
                    style={{
                      padding: "40px",
                      textAlign: "center",
                      backgroundColor: "#f9f9f9",
                    }}
                  >
                    <p style={{ fontSize: "16px", color: "#666" }}>No products found.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* PRICES TAB */}
      {tab === "prices" && (
        <div>
          <h3 style={{ marginBottom: 8 }}>Set Product Prices (Manual)</h3>
          <div style={{ opacity: 0.8, marginBottom: 10 }}>
            Enter new prices and click "Save Prices".
          </div>

          {prodLoading && (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p style={{ marginTop: "10px" }}>Loading products...</p>
            </div>
          )}

          {prodError && (
            <div
              style={{
                padding: "15px",
                marginBottom: "20px",
                backgroundColor: "#fee",
                border: "1px solid #fcc",
                borderRadius: "8px",
                color: "#c33",
              }}
            >
              <strong>Error:</strong> {prodError}
            </div>
          )}

          {!prodLoading && !prodError && (
            <>
              <button
                onClick={savePrices}
                disabled={priceLoading}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  background: "white",
                  cursor: priceLoading ? "not-allowed" : "pointer",
                  marginBottom: 12,
                  opacity: priceLoading ? 0.6 : 1,
                }}
              >
                {priceLoading ? "Saving..." : "Save Prices"}
              </button>

              {priceMsg && (
                <div
                  style={{
                    padding: "12px",
                    marginBottom: "10px",
                    backgroundColor: "#d4edda",
                    border: "1px solid #c3e6cb",
                    borderRadius: "8px",
                    color: "#155724",
                  }}
                >
                  {priceMsg}
                </div>
              )}

              {priceErr && (
                <div
                  style={{
                    padding: "12px",
                    marginBottom: "10px",
                    backgroundColor: "#fee",
                    border: "1px solid #fcc",
                    borderRadius: "8px",
                    color: "#c33",
                  }}
                >
                  <strong>Error:</strong> {priceErr}
                </div>
              )}

              <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                      <th style={{ padding: 10 }}>Name</th>
                      <th style={{ padding: 10 }}>Current Price</th>
                      <th style={{ padding: 10 }}>New Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p._id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <td style={{ padding: 10 }}>{p.name}</td>
                        <td style={{ padding: 10 }}>{Number(p.price ?? 0).toFixed(2)} TL</td>
                        <td style={{ padding: 10 }}>
                          <input
                            value={priceEdits[p._id] ?? ""}
                            placeholder="e.g. 199.99"
                            onChange={(e) =>
                              setPriceEdits((prev) => ({ ...prev, [p._id]: e.target.value }))
                            }
                            style={{ width: 140 }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!products.length && (
                  <div
                    style={{
                      padding: "40px",
                      textAlign: "center",
                      backgroundColor: "#f9f9f9",
                    }}
                  >
                    <p style={{ fontSize: "16px", color: "#666" }}>No products found.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ANALYTICS TAB */}
      {tab === "analytics" && (
        <div>
          <h3 style={{ marginBottom: 8 }}>Revenue / Cost / Profit</h3>

          <button
            onClick={loadAnalytics}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: "white",
              cursor: "pointer",
              marginBottom: 12,
            }}
          >
            Refresh Analytics
          </button>

          {anLoading && (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p style={{ marginTop: "10px" }}>Loading analytics...</p>
            </div>
          )}

          {anError && (
            <div
              style={{
                padding: "15px",
                marginBottom: "20px",
                backgroundColor: "#fee",
                border: "1px solid #fcc",
                borderRadius: "8px",
                color: "#c33",
              }}
            >
              <strong>Error:</strong> {anError}
            </div>
          )}

          {analytics && !anLoading && !anError && (
            <>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
                  <div style={{ fontWeight: 700 }}>Revenue</div>
                  <div>{Number(analytics.revenue ?? 0).toFixed(2)} TL</div>
                </div>
                <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
                  <div style={{ fontWeight: 700 }}>Cost</div>
                  <div>{Number(analytics.cost ?? 0).toFixed(2)} TL</div>
                </div>
                <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
                  <div style={{ fontWeight: 700 }}>Profit</div>
                  <div>{Number(analytics.profit ?? 0).toFixed(2)} TL</div>
                </div>
              </div>

              <LineChart
                data={analytics.series || []}
                valueKey="profit"
                title="Profit by Day (Chart)"
              />

              <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                      <th style={{ padding: 10 }}>Date</th>
                      <th style={{ padding: 10 }}>Revenue</th>
                      <th style={{ padding: 10 }}>Cost</th>
                      <th style={{ padding: 10 }}>Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics.series || []).map((s) => (
                      <tr key={s.date} style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <td style={{ padding: 10 }}>{s.date}</td>
                        <td style={{ padding: 10 }}>{Number(s.revenue).toFixed(2)}</td>
                        <td style={{ padding: 10 }}>{Number(s.cost).toFixed(2)}</td>
                        <td style={{ padding: 10 }}>{Number(s.profit).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {(!analytics.series || !analytics.series.length) && (
                  <div
                    style={{
                      padding: "40px",
                      textAlign: "center",
                      backgroundColor: "#f9f9f9",
                    }}
                  >
                    <p style={{ fontSize: "16px", color: "#666" }}>
                      No analytics data in selected range.
                    </p>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 10, opacity: 0.7 }}>
                Note: If product cost is not set, system assumes default cost = 50% of sale price.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
