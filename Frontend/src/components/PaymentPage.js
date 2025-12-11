import React, { useState } from "react";
import { Container, Card, Form, Button } from "react-bootstrap";
import { useCart } from "../context/CartContext";

export default function PaymentPage() {
  const { cart, setCart } = useCart();

  const [form, setForm] = useState({
    cardName: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
  });

  const [showCVV, setShowCVV] = useState(false);

  const handleChange = (e) => {
        let { name, value } = e.target;

        // Auto-format card number (#### #### #### ####)
        if (name === "cardNumber") {
            value = value.replace(/\D/g, "");               // sadece rakam
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

  return (
    <Container style={{ marginTop: "120px", maxWidth: "600px" }}>
      <Card className="p-4 shadow">
        <h3 className="text-center mb-4">Payment Information</h3>

        <Form>
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

          <Form.Group className="mb-3">
            <Form.Label>Card Number</Form.Label>
            <Form.Control
              type="text"
              name="cardNumber"
              placeholder="1234 5678 9012 3456"
              value={form.cardNumber}
              onChange={handleChange}
              maxLength={16}
            />
          </Form.Group>

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

        <hr className="my-4" />

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
