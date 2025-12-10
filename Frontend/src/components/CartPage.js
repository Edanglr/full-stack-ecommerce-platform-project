// src/components/CartPage.js
import React, { useEffect, useState } from "react";
import { Container, Row, Col, Card, Button, Image } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";

function CartPage() {
  const { cart, setCart } = useCart();
  const [cartItems, setCartItems] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    setCartItems(cart);
  }, [cart]);

  const updateCart = (items) => {
    setCartItems(items);
    setCart(items);
  };

  const removeItem = (index) => {
    const updated = [...cartItems];
    updated.splice(index, 1);
    updateCart(updated);
  };

  const handleCheckout = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      alert("Please log in before placing an order.");
      navigate("/login");
      return;
    }

    try {
      const orderItems = cartItems.map((item) => ({
        productId: item.productId,
        name: item.name,
        price: item.price,
        size: item.size,
        quantity: item.quantity,
        imageUrl: item.image,
      }));

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
        alert(data.message || "Order failed");
        return;
      }

      alert(
        `Order created successfully!\nYour tracking code: ${data.trackingCode}`
      );

      // Sepeti temizle
      setCart([]);
      setCartItems([]);

      // Invoice sayfasına yönlendir
      navigate(`/invoice/${data.orderId}`, {
        state: { invoice: data.invoice },
      });
    } catch (err) {
      console.error("CHECKOUT ERROR:", err);
      alert("Error while creating order.");
    }
  };

  const subtotal = cartItems
    .reduce((acc, item) => acc + item.price * item.quantity, 0)
    .toFixed(2);

  return (
    <Container className="my-5">
      <div style={{ marginTop: "100px" }}></div>
      <h2 className="text-center mb-4">Shopping Cart</h2>

      {cartItems.length === 0 ? (
        <div className="text-center">
          <p>Your cart is empty.</p>
          <Button as={Link} to="/" variant="dark">
            Continue Shopping
          </Button>
        </div>
      ) : (
        <Row>
          <Col md={8}>
            {cartItems.map((item, index) => (
              <Card key={index} className="mb-3">
                <Row className="g-0">
                  <Col md={3}>
                    <Image
                      src={item.image}
                      alt={item.name}
                      fluid
                      rounded
                      style={{
                        width: "150px",
                        height: "170px",
                        objectFit: "cover",
                      }}
                    />
                  </Col>
                  <Col md={9}>
                    <Card.Body>
                      <Row>
                        <Col xs={6}>
                          <Card.Title>{item.name}</Card.Title>
                          <Card.Text className="text-muted">
                            {item.price} TL
                          </Card.Text>
                          <Card.Text>Size: {item.size}</Card.Text>
                          <Card.Text>Quantity: {item.quantity}</Card.Text>
                        </Col>
                        <Col xs={3}></Col>
                        <Col xs={3} className="text-end">
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => removeItem(index)}
                          >
                            Remove
                          </Button>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Col>
                </Row>
              </Card>
            ))}
          </Col>

          <Col md={4}>
            <Card>
              <Card.Body>
                <Card.Title>Order Summary</Card.Title>
                <hr />
                <div className="d-flex justify-content-between mb-2">
                  <span>Subtotal:</span>
                  <span>{subtotal} TL</span>
                </div>

                <div className="d-flex justify-content-between mb-3">
                  <span>Shipping:</span>
                  <span>FREE</span>
                </div>

                <div className="d-flex justify-content-between fw-bold">
                  <span>Total:</span>
                  <span>{subtotal} TL</span>
                </div>

                <Button
                  variant="dark"
                  className="w-100 mt-3"
                  onClick={handleCheckout}
                >
                  Proceed to Checkout
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </Container>
  );
}

export default CartPage;
