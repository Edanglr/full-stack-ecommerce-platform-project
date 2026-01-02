import React, { useEffect, useState } from "react";
import ProfileLayout from "./ProfileLayout";

function PaymentMethodsPage() {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

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
      console.error("FETCH ERROR:", err);
    } finally {
      setLoading(false);
    }
  };

  const savePaymentMethod = async () => {
    if (!cardNumber || !expiry || !cvv) {
      alert("Please fill in all fields.");
      return;
    }

    // Kart numarasını temizle (Boşlukları siler)
    const cleanCardNumber = cardNumber.replace(/\s+/g, "");

    const token = localStorage.getItem("token");
    try {
      const res = await fetch("http://localhost:5050/api/payments/add", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cardNumber: cleanCardNumber,
          expiry: expiry.trim(),
          cvv: cvv.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert("Payment method added!");
        setShowModal(false);
        setCardNumber("");
        setExpiry("");
        setCvv("");
        fetchMethods();
      } else {
        alert(data.message || "Failed to save payment method.");
      }
    } catch (err) {
      alert("Unexpected error occurred. Please check your connection.");
    }
  };

  const removePaymentMethod = async (id) => {
    const token = localStorage.getItem("token");
    if (!window.confirm("Delete this?")) return;
    try {
      const res = await fetch(`http://localhost:5050/api/payments/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchMethods();
    } catch (err) {
      alert("Delete failed.");
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
      <div style={{ maxWidth: "800px", margin: "40px auto", padding: "0 20px" }}>
        <h2 style={{ marginBottom: "20px" }}>Payment Methods</h2>

        {methods.length === 0 ? (
          <div style={{ padding: "20px", background: "#f9f9f9", borderRadius: "8px", border: "1px dashed #ccc", textAlign: "center", marginBottom: "20px" }}>
            <p>No payment methods added yet.</p>
          </div>
        ) : (
          <ul style={{ paddingLeft: 0 }}>
            {methods.map((m) => (
              <li key={m._id} style={{ listStyle: "none", padding: "15px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #ddd", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff" }}>
                <div>
                  <strong>Card:</strong> **** **** **** {m.last4}
                  <br />
                  <small style={{ color: "#666" }}>Expiry: {m.expiry}</small>
                </div>
                <button onClick={() => removePaymentMethod(m._id)} style={{ padding: "6px 12px", background: "#ff4d4d", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* ADD BUTTON - MUTLAKA BURADA OLMALI */}
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: "12px 20px",
            background: "#000",
            color: "#fff",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          + Add New Payment Method
        </button>
      </div>

      {/* MODAL */}
      {showModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", padding: "30px", borderRadius: "12px", width: "400px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
            <h3 style={{ marginBottom: "20px" }}>Add Payment Method</h3>
            
            <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>Card Number</label>
            <input
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              placeholder="1234 5678 9012 3456"
              style={{ width: "100%", padding: "10px", marginBottom: "15px", borderRadius: "6px", border: "1px solid #ddd" }}
            />

            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>Expiry (MM/YY)</label>
                <input
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  placeholder="12/26"
                  style={{ width: "100%", padding: "10px", marginBottom: "15px", borderRadius: "6px", border: "1px solid #ddd" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>CVV</label>
                <input
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                  placeholder="123"
                  maxLength="3"
                  style={{ width: "100%", padding: "10px", marginBottom: "15px", borderRadius: "6px", border: "1px solid #ddd" }}
                />
              </div>
            </div>

            <button onClick={savePaymentMethod} style={{ width: "100%", padding: "12px", background: "#000", color: "#fff", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: "bold", marginBottom: "10px" }}>
              Save Card
            </button>
            <button onClick={() => setShowModal(false)} style={{ width: "100%", padding: "12px", background: "#eee", color: "#333", borderRadius: "8px", border: "none", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </ProfileLayout>
  );
}

export default PaymentMethodsPage;
