// src/components/OrderHistoryPage.js
import React, { useEffect, useState } from "react";

function OrderHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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
          headers: {
            Authorization: `Bearer ${token}`,
          },
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

  if (loading) {
    return <div style={{ padding: "120px 20px" }}>Loading orders...</div>;
  }

  return (
    <div style={{ padding: "120px 20px", maxWidth: "900px", margin: "0 auto" }}>
      <h2 style={{ marginBottom: "20px" }}>My Orders</h2>

      {error && (
        <p style={{ color: "red", fontWeight: 500, marginBottom: "15px" }}>
          {error}
        </p>
      )}

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
            <strong>Order ID:</strong> {order._id}
            <br />
            <strong>Tracking Code:</strong> {order.trackingCode}
            <br />
            <strong>Date:</strong>{" "}
            {order.createdAt
              ? new Date(order.createdAt).toLocaleString()
              : "-"}
            <br />
            <strong>Status:</strong> {order.shippingStatus}
            <br />
            <strong>Total:</strong> {order.totalAmount} TL
          </div>

          {/* Shipping history */}
          {order.shippingHistory && order.shippingHistory.length > 0 && (
            <>
              <h5 style={{ marginTop: "10px" }}>Shipping History</h5>
              <ul style={{ paddingLeft: "18px" }}>
                {order.shippingHistory.map((entry, idx) => (
                  <li key={idx}>
                    {new Date(entry.date).toLocaleString()} —{" "}
                    <strong>{entry.status}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Items with images */}
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
                }}
              >
                {/* Product Image */}
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    style={{
                      width: "80px",
                      height: "80px",
                      objectFit: "cover",
                      borderRadius: "4px",
                      flexShrink: 0,
                    }}
                    onError={(e) => {
                      e.target.src = "https://via.placeholder.com/80?text=No+Image";
                    }}
                  />
                )}
                
                {/* Product Details */}
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 4px 0", fontWeight: "600", fontSize: "15px" }}>
                    {item.name}
                  </p>
                  <p style={{ margin: "0 0 2px 0", fontSize: "14px", color: "#666" }}>
                    Size: {item.size}, Qty: {item.quantity}
                  </p>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "500" }}>
                    {item.price} TL
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default OrderHistoryPage;
