// src/components/TrackingPage.js
import React, { useState } from "react";

export default function TrackingPage() {
  const [code, setCode] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    setError("");
    setData(null);

    if (code.trim() === "") {
      setError("Please enter a tracking code.");
      return;
    }

    try {
      const res = await fetch(`http://localhost:5050/api/orders/track/${code}`);

      if (!res.ok) {
        setError("Tracking code not found.");
        return;
      }

      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("TRACK ERROR:", err);
      setError("Server error. Please try again later.");
    }
  };

  return (
    <div style={{ padding: "100px", maxWidth: "800px", margin: "auto" }}>
      <h2 style={{ marginBottom: "20px" }}>Order Tracking</h2>

      {/* SEARCH BAR */}
      <div style={{ display: "flex", gap: "10px" }}>
        <input
          type="text"
          placeholder="Enter your tracking code..."
          value={code}
          onChange={(e) => setCode(e.target.value)}
          style={{
            flex: 1,
            padding: "12px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            fontSize: "16px",
          }}
        />
        <button
          onClick={handleSearch}
          style={{
            padding: "12px 20px",
            borderRadius: "6px",
            background: "black",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          Track
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <p style={{ marginTop: "15px", color: "red", fontWeight: "500" }}>
          {error}
        </p>
      )}

      {/* TRACKING RESULT */}
      {data && (
        <div style={{ marginTop: "40px" }}>
          <h3>Tracking Code: {data.trackingCode}</h3>
          <p>
            <strong>Status:</strong> {data.shippingStatus}
          </p>

          {/* SHIPPING HISTORY */}
          <h4 style={{ marginTop: "25px" }}>Shipping History</h4>
          <ul style={{ lineHeight: "1.8" }}>
            {data.shippingHistory.map((entry, index) => (
              <li key={index}>
                {new Date(entry.date).toLocaleString()} —{" "}
                <strong>{entry.status}</strong>
              </li>
            ))}
          </ul>

          {/* ORDER ITEMS */}
          <h4 style={{ marginTop: "25px" }}>Order Items</h4>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "15px" }}
          >
            {data.items.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "20px",
                  padding: "15px",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                }}
              >
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  style={{
                    width: "80px",
                    height: "80px",
                    objectFit: "cover",
                    borderRadius: "4px",
                  }}
                />
                <div>
                  <p style={{ margin: 0, fontWeight: "600" }}>{item.name}</p>
                  <p style={{ margin: 0 }}>Size: {item.size}</p>
                  <p style={{ margin: 0 }}>Quantity: {item.quantity}</p>
                  <p style={{ margin: 0 }}>Price: {item.price} TL</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
