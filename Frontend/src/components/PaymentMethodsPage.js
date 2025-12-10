// src/components/PaymentMethodsPage.js
import React, { useEffect, useState } from "react";
import ProfileLayout from "./ProfileLayout";

function PaymentMethodsPage() {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);

  // Form fields
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");

  useEffect(() => {
    fetchMethods();
  }, []);

  const fetchMethods = async () => {
    const token = localStorage.getItem("token");

    try {
      const res = await fetch("http://localhost:5050/api/payments/my", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (res.ok) setMethods(data);
      else setMethods([]);
    } catch (err) {
      console.error("PAYMENT FETCH ERROR:", err);
    }

    setLoading(false);
  };

  const savePaymentMethod = async () => {
    if (!cardNumber || !expiry || !cvv) {
      alert("Please fill in all fields.");
      return;
    }

    const token = localStorage.getItem("token");

    try {
      const res = await fetch("http://localhost:5050/api/payments/add", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cardNumber,
          expiry,
          cvv,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert("Payment method added!");
        setShowModal(false);
        fetchMethods(); // refresh list
      } else {
        alert(data.message || "Failed to save payment method.");
      }
    } catch (err) {
      console.error("PAYMENT SAVE ERROR:", err);
      alert("Unexpected error occurred.");
    }
  };

  // ❌ REMOVE PAYMENT METHOD
  const removePaymentMethod = async (id) => {
    const token = localStorage.getItem("token");

    if (!window.confirm("Delete this payment method?")) return;

    try {
      const res = await fetch(`http://localhost:5050/api/payments/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (res.ok) {
        alert("Payment method removed.");
        fetchMethods(); // refresh list
      } else {
        alert(data.message || "Failed to delete payment method.");
      }
    } catch (err) {
      console.error("PAYMENT DELETE ERROR:", err);
      alert("Unexpected error occurred.");
    }
  };

  if (loading) {
    return (
      <ProfileLayout>
        <div style={{ padding: "20px" }}>Loading payment methods...</div>
      </ProfileLayout>
    );
  }

  return (
    <ProfileLayout>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <h2>Payment Methods</h2>

        {methods.length === 0 ? (
          <p>No payment methods added yet.</p>
        ) : (
          <ul style={{ paddingLeft: 0 }}>
            {methods.map((m) => (
              <li
                key={m._id}
                style={{
                  listStyle: "none",
                  padding: "12px 15px",
                  marginBottom: "10px",
                  borderRadius: "8px",
                  border: "1px solid #ddd",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong>Card:</strong> **** **** **** {m.last4}
                  <br />
                  <strong>Expiry:</strong> {m.expiry}
                </div>

                {/* DELETE BUTTON */}
                <button
                  onClick={() => removePaymentMethod(m._id)}
                  style={{
                    padding: "6px 10px",
                    background: "red",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={() => setShowModal(true)}
          style={{
            marginTop: "15px",
            padding: "10px 15px",
            background: "#000",
            color: "#fff",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Add Payment Method
        </button>
      </div>

      {/* ADD PAYMENT MODAL */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 999,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "20px",
              borderRadius: "10px",
              width: "400px",
            }}
          >
            <h3>Add Payment Method</h3>

            <label>Card Number</label>
            <input
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              placeholder="1234 5678 9012 3456"
              style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
            />

            <label>Expiry Date</label>
            <input
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              placeholder="MM/YY"
              style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
            />

            <label>CVV</label>
            <input
              value={cvv}
              onChange={(e) => setCvv(e.target.value)}
              placeholder="123"
              style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
            />

            <button
              onClick={savePaymentMethod}
              style={{
                width: "100%",
                padding: "10px",
                background: "#000",
                color: "#fff",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Save
            </button>

            <button
              onClick={() => setShowModal(false)}
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #aaa",
                borderRadius: "6px",
                marginTop: "10px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </ProfileLayout>
  );
}

export default PaymentMethodsPage;
