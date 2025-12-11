


import React, { useState } from "react";
import { Container, Card, Form, Button } from "react-bootstrap";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";


export default function PaymentPage() {
  const { cart, setCart } = useCart();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    cardName: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
  });

  const [showCVV, setShowCVV] = useState(false);
  const [loading, setLoading] = useState(false);

  // -------- HANDLE CHANGE (AUTO FORMAT) --------
  const handleChange = (e) => {
    let { name, value } = e.target;

    // Auto-format card number (#### #### #### ####)
    if (name === "cardNumber") {
      value = value.replace(/\D/g, ""); // sadece rakam
      value = value.replace(/(.{4})/g, "$1 ").trim(); // 4lü grup
    }

    // Auto-format expiry (MM/YY)
    if (name === "expiry") {
      value = value.replace(/\D/g, "").slice(0, 4);
      if (value.length >= 3) {
        value = value.slice(0, 2) + "/" + value.slice(2);
      }
    }

    setForm({ ...form, [name]: value });
  };

  // -------- HANDLE PAYMENT (FAKE PAYMENT + ORDER CREATE) --------
  const handlePayment = async () => {
    if (!form.cardName || !form.cardNumber || !form.expiry || !form.cvv) {
      alert("Please fill out all fields");
      return;
    }

    if (form.cvv.length !== 3) {
      alert("CVV must be 3 digits");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please log in before payment");
      navigate("/login");
      return;
    }

    setLoading(true);

    const orderItems = cart.map((item) => ({
      productId: item.productId,
      name: item.name,
      price: item.price,
      size: item.size,
      quantity: item.quantity,
      imageUrl: item.image,
    }));

    try {
      const res = await fetch("http://localhost:5050/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ items: orderItems }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLoading(false);
        alert(data.message || "Payment failed");
        return;
      }

      alert("Payment successful!");

      setCart([]);

      navigate(`/invoice/${data.orderId}`, {
        state: { invoice: data.invoice },
      });

    } catch (err) {
      console.error("PAYMENT ERROR:", err);
      alert("Payment failed. Please try again.");
      setLoading(false);
    }
  };

  // -------- UI --------
  return (
    <Container style={{ marginTop: "120px", maxWidth: "600px" }}>
      <Card className="p-4 shadow">
        <h3 className="text-center mb-4">Payment Information</h3>

        <Form>
          {/* Cardholder Name */}
          <Form.Group className="mb-3">
            <Form.Label>Cardholder Name</Form.Label>
            <Form.Control
              type="text"
              name="cardName"
              placeholder="John Doe"
              value={form.cardName}
              onChange={handleChange}
            />
          </Form.Group>

          {/* Card Number */}
          <Form.Group className="mb-3">
            <Form.Label>Card Number</Form.Label>
            <Form.Control
              type="text"
              name="cardNumber"
              placeholder="1234 5678 9012 3456"
              value={form.cardNumber}
              onChange={handleChange}
              maxLength={19}
            />
          </Form.Group>

          {/* Expiry */}
          <Form.Group className="mb-3">
            <Form.Label>Expiry Date</Form.Label>
            <Form.Control
              type="text"
              name="expiry"
              placeholder="MM/YY"
              value={form.expiry}
              onChange={handleChange}
              maxLength={5}
            />
          </Form.Group>

          {/* CVV */}
          <Form.Group className="mb-3">
            <Form.Label>CVV</Form.Label>
            <div style={{ position: "relative" }}>
              <Form.Control
                type={showCVV ? "text" : "password"}
                name="cvv"
                placeholder="123"
                value={form.cvv}
                onChange={handleChange}
                maxLength={3}
              />

              <span
                onClick={() => setShowCVV(!showCVV)}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  cursor: "pointer",
                  fontSize: "14px",
                  opacity: 0.7,
                }}
              >
                {showCVV ? "Hide" : "Show"}
              </span>
            </div>
          </Form.Group>
        </Form>

        {/* Payment Button */}
        <Button
          variant="dark"
          className="w-100 mt-3"
          disabled={loading}
          onClick={handlePayment}
        >
          {loading ? "Processing..." : "Complete Payment"}
        </Button>

        <hr className="my-4" />

        {/* Order Summary */}
        <h5>Order Summary</h5>

        {cart.length === 0 ? (
          <p>Your cart is empty.</p>
        ) : (
          <ul>
            {cart.map((item, index) => (
              <li key={index}>
                {item.quantity} x {item.name} — {item.price} TL
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Container>
  );
}
