import React, { useEffect, useState } from "react";

function AdminOrdersPage() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch(
        "http://localhost:5050/api/orders/admin/deliveries",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await res.json();
      setDeliveries(data);
    } catch (err) {
      console.error("Fetch deliveries error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      setUpdatingId(orderId);
      const token = localStorage.getItem("token");
      const res = await fetch(
        `http://localhost:5050/api/orders/${orderId}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.message || "Error updating status");
        return;
      }

      await fetchDeliveries();
    } catch (err) {
      console.error("Update status error:", err);
      alert("Unexpected error updating status.");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return <p style={{ padding: 20 }}>Loading delivery list...</p>;
  }

  return (
    <div style={{ padding: 20, marginTop: 120 }}>
      <h2>Delivery List (Product Manager)</h2>
      <p>
        Below is the delivery list with delivery ID, customer, product,
        quantity, total price, address and completion status.
      </p>

      {deliveries.length === 0 && <p>No deliveries yet.</p>}

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: 10,
          fontSize: "0.9rem",
        }}
      >
        <thead>
          <tr>
            <th style={thStyle}>Delivery ID</th>
            <th style={thStyle}>Customer</th>
            <th style={thStyle}>Product</th>
            <th style={thStyle}>Qty</th>
            <th style={thStyle}>Total Price</th>
            <th style={thStyle}>Address</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Completed</th>
            <th style={thStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {deliveries.map((d) => (
            <tr key={`${d.deliveryId}-${d.productId}-${d.quantity}`}>
              <td style={tdStyle}>{d.deliveryId}</td>
              <td style={tdStyle}>{d.customerName}</td>
              <td style={tdStyle}>{d.productName}</td>
              <td style={tdStyle}>{d.quantity}</td>
              <td style={tdStyle}>{d.totalPrice} TL</td>
              <td style={tdStyle}>{d.deliveryAddress}</td>
              <td style={tdStyle}>{d.shippingStatus}</td>
              <td style={tdStyle}>{d.completed ? "Yes" : "No"}</td>
              <td style={tdStyle}>
                <select
                  defaultValue={d.shippingStatus}
                  onChange={(e) =>
                    handleStatusChange(d.deliveryId, e.target.value)
                  }
                  disabled={updatingId === d.deliveryId}
                >
                  <option value="Processing">Processing</option>
                  <option value="In-transit">In-transit</option>
                  <option value="Delivered">Delivered</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle = {
  borderBottom: "1px solid #ccc",
  padding: "8px",
  textAlign: "left",
};

const tdStyle = {
  borderBottom: "1px solid #eee",
  padding: "8px",
};

export default AdminOrdersPage;
