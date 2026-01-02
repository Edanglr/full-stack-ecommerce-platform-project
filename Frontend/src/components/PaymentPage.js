import React, { useState, useEffect } from "react"; // useEffect eklendi
import { Container, Card, Form, Button, Alert } from "react-bootstrap";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";

export default function PaymentPage() {
  const { cart, setCart } = useCart();
  const navigate = useNavigate();

  // --- STATE ---
  const [form, setForm] = useState({
    cardName: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
  });
  const [savedMethods, setSavedMethods] = useState([]); // Kayıtlı kartlar
  const [useSavedCard, setUseSavedCard] = useState(false); // Seçenek kontrolü
  const [selectedCardId, setSelectedCardId] = useState("");
  const [showCVV, setShowCVV] = useState(false);
  const [loading, setLoading] = useState(false);

  // --- KAYITLI KARTLARI GETİR ---
  useEffect(() => {
    const fetchSavedCards = async () => {
      const token = localStorage.getItem("token");
      try {
        const res = await fetch("http://localhost:5050/api/payments/my", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.length > 0) {
          setSavedMethods(data);
          setUseSavedCard(true); // Kart varsa varsayılan olarak seçeneği göster
          setSelectedCardId(data[0]._id); // İlk kartı seç
        }
      } catch (err) {
        console.error("Fetch saved cards error:", err);
      }
    };
    fetchSavedCards();
  }, []);

  const handleChange = (e) => {
    let { name, value } = e.target;
    if (name === "cardNumber") {
      value = value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim();
    }
    if (name === "expiry") {
      value = value.replace(/\D/g, "").slice(0, 4);
      if (value.length >= 3) value = value.slice(0, 2) + "/" + value.slice(2);
    }
    setForm({ ...form, [name]: value });
  };

  const handlePayment = async () => {
    // Validasyonlar (Kayıtlı kart seçiliyse sadece CVV kontrolü veya direkt işlem yapılabilir)
    if (!useSavedCard && (!form.cardName || !form.cardNumber || !form.expiry || !form.cvv)) {
      alert("Please fill out all fields");
      return;
    }

    const token = localStorage.getItem("token");
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
        // Backend'e hangi kartın kullanıldığını da gönderebilirsin
        body: JSON.stringify({ 
          items: orderItems,
          paymentMethodId: useSavedCard ? selectedCardId : "new_card" 
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      alert("Payment successful!");
      setCart([]);
      navigate(`/invoice/${data.orderId}`, { state: { invoice: data.invoice } });
    } catch (err) {
      alert(err.message || "Payment failed");
      setLoading(false);
    }
  };

  return (
    <Container style={{ marginTop: "120px", maxWidth: "600px" }}>
      <Card className="p-4 shadow">
        <h3 className="text-center mb-4">Payment</h3>

        {/* --- SEÇENEK: KAYITLI KART MI YENİ KART MI? --- */}
        {savedMethods.length > 0 && (
          <div className="mb-4 d-flex justify-content-around">
            <Button 
              variant={useSavedCard ? "dark" : "outline-dark"} 
              onClick={() => setUseSavedCard(true)}
            >
              Use Saved Card
            </Button>
            <Button 
              variant={!useSavedCard ? "dark" : "outline-dark"} 
              onClick={() => setUseSavedCard(false)}
            >
              Add New Card
            </Button>
          </div>
        )}

        <Form>
          {useSavedCard ? (
            /* KAYITLI KARTLAR LİSTESİ */
            <Form.Group className="mb-3">
              <Form.Label>Select a Saved Card</Form.Label>
              <Form.Select 
                value={selectedCardId} 
                onChange={(e) => setSelectedCardId(e.target.value)}
              >
                {savedMethods.map((m) => (
                  <option key={m._id} value={m._id}>
                    **** **** **** {m.last4} ({m.expiry})
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          ) : (
            /* YENİ KART FORMU (Mevcut formunuz) */
            <>
              <Form.Group className="mb-3">
                <Form.Label>Cardholder Name</Form.Label>
                <Form.Control type="text" name="cardName" value={form.cardName} onChange={handleChange} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Card Number</Form.Label>
                <Form.Control type="text" name="cardNumber" value={form.cardNumber} onChange={handleChange} maxLength={19} />
              </Form.Group>
              <div className="d-flex gap-2">
                <Form.Group className="mb-3 flex-grow-1">
                  <Form.Label>Expiry</Form.Label>
                  <Form.Control type="text" name="expiry" value={form.expiry} onChange={handleChange} maxLength={5} />
                </Form.Group>
                <Form.Group className="mb-3 flex-grow-1">
                  <Form.Label>CVV</Form.Label>
                  <Form.Control type="password" name="cvv" value={form.cvv} onChange={handleChange} maxLength={3} />
                </Form.Group>
              </div>
            </>
          )}

          <Button variant="success" className="w-100 mt-3" disabled={loading} onClick={handlePayment}>
            {loading ? "Processing..." : "Complete Payment"}
          </Button>
        </Form>
      </Card>
    </Container>
  );
}
