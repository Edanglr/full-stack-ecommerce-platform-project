import React, { useEffect, useState } from "react";

function CustomerOrderInfo({ customerId }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!customerId) return;

    const fetchOrders = async () => {
      try {
        setLoading(true);

        const res = await fetch(
          `http://localhost:5050/api/orders/by-user/${customerId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) {
          setOrders([]);
          return;
        }

        const data = await res.json();
        setOrders(data || []);
      } catch (err) {
        console.error("Fetch customer orders error:", err);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [customerId, token]);

  if (!customerId) {
    return <p style={{ color: "#666" }}>Select a chat to see orders.</p>;
  }

  if (loading) {
    return <p>Loading orders...</p>;
  }

  if (orders.length === 0) {
    return <p>No orders found for this customer.</p>;
  }

  return (
    <div>
      <h4>Customer Orders</h4>

      {orders.map((o) => (
        <div
          key={o._id}
          style={{
            border: "1px solid #ddd",
            borderRadius: 6,
            padding: 8,
            marginBottom: 8,
            fontSize: "0.85rem",
          }}
        >
          <div><b>Order ID:</b> {o._id}</div>
          <div><b>Status:</b> {o.status}</div>
          <div><b>Total:</b> {o.totalPrice} TL</div>
          <div>
            <b>Date:</b>{" "}
            {new Date(o.createdAt).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
}

export default CustomerOrderInfo;
