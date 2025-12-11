// src/components/OrderHistoryPage.js
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

function OrderHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const location = useLocation();

  const linkBaseStyle = {
    display: "block",
    marginBottom: "12px",
    color: "#111",
    textDecoration: "none",
    fontSize: "14px",
  };

  const activeStyle = { fontWeight: "600" };

  const makeStyle = (path) => ({
    ...linkBaseStyle,
    ...(location.pathname === path ? activeStyle : {}),
  });

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("You must be logged in to view your orders.");
      setLoading(false);
      return;
    }

    const fetchOrders = async () => {
      try {
        const res = await fetch("http://localhost:5050/api/orders/my", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.message || "Failed to load your orders.");
          setLoading(false);
          return;
        }

        const data = await res.json();
        setOrders(data || []);
      } catch (err) {
        console.error("ORDER HISTORY ERROR:", err);
        setError("Unexpected error while loading orders.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  if (loading) return <div style={{ padding: "120px 20px" }}>Loading orders...</div>;

  return (
    <div
      style={{
        maxWidth: "1100px",
        margin: "0 auto",
        paddingTop: "120px",
        paddingBottom: "40px",
        display: "flex",
        gap: "40px",
        alignItems: "flex-start",
      }}
    >
      {/* LEFT MENU */}
      <aside style={{ width: "180px" }}>
        <nav>
          <Link to="/orders" style={makeStyle("/orders")}>Orders</Link>
          <Link to="/returns" style={makeStyle("/returns")}>Returns</Link>
          <Link to="/payment-methods" style={makeStyle("/payment-methods")}>Payment Methods</Link>
          <Link to="/profile" style={makeStyle("/profile")}>Profile</Link>
          <Link to="/settings" style={makeStyle("/settings")}>Settings</Link>
          <Link to="/favorites" style={makeStyle("/favorites")}>Favorites</Link>
        </nav>
      </aside>

      {/* RIGHT CONTENT */}
      <main style={{ flex: 1 }}>
        <h2 style={{ marginBottom: "20px" }}>My Orders</h2>

        {error && <p style={{ color: "red", fontWeight: 500 }}>{error}</p>}

        {!error && orders.length === 0 && <p>You don't have any orders yet.</p>}

        {orders.map((order) => (
          <div
            key={order._id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "8px",
              padding: "15px 20px",
              marginBottom: "20px",
            }}
          >
            <div style={{ marginBottom: "10px" }}>
              <strong>Order ID:</strong> {order._id} <br />
              <strong>Tracking Code:</strong> {order.trackingCode} <br />
              <strong>Date:</strong>{" "}
              {order.createdAt ? new Date(order.createdAt).toLocaleString() : "-"} <br />
              <strong>Status:</strong> {order.shippingStatus} <br />
              <strong>Total:</strong> {order.totalAmount} TL
            </div>

            {/* SHIPPING HISTORY */}
            {order.shippingHistory?.length > 0 && (
              <>
                <h5 style={{ marginTop: "10px" }}>Shipping History</h5>
                <ul style={{ paddingLeft: "18px" }}>
                  {order.shippingHistory.map((entry, idx) => (
                    <li key={idx}>
                      {new Date(entry.date).toLocaleString()} — <strong>{entry.status}</strong>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* ITEMS */}
            <h5 style={{ marginTop: "10px" }}>Items</h5>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {order.items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "15px",
                    padding: "12px",
                    border: "1px solid #e5e5e5",
                    borderRadius: "6px",
                    backgroundColor: "#fafafa",
                    position: "relative", // ⭐ return butonu için şart
                  }}
                >
                  {/* PRODUCT IMAGE */}
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      style={{
                        width: "80px",
                        height: "80px",
                        objectFit: "cover",
                        borderRadius: "4px",
                      }}
                      onError={(e) => {
                        e.target.src = "https://via.placeholder.com/80?text=No+Image";
                      }}
                    />
                  )}

                  {/* DETAILS */}
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 4px 0", fontWeight: "600" }}>{item.name}</p>
                    <p style={{ margin: "0 0 2px 0", color: "#666" }}>
                      Size: {item.size}, Qty: {item.quantity}
                    </p>
                    <p style={{ margin: 0, fontWeight: "500" }}>{item.price} TL</p>
                  </div>

                  {/* ⭐ RETURN BUTTON */}
                  <button
                    onClick={() => alert("Return request for: " + item.name)}
                    style={{
                      position: "absolute",
                      right: "10px",
                      bottom: "10px",
                      padding: "6px 10px",
                      fontSize: "12px",
                      backgroundColor: "black",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Return
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

export default OrderHistoryPage;
