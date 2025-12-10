// Frontend/src/components/InvoicePage.js
import React, { useEffect, useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Table,
  Button,
  Spinner,
} from "react-bootstrap";
import { useLocation, useParams, useNavigate } from "react-router-dom";

function InvoicePage() {
  const { orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState(location.state?.invoice || null);
  const [loading, setLoading] = useState(!location.state?.invoice);
  const [error, setError] = useState("");

  useEffect(() => {
    // Eğer state üzerinden invoice geldiyse ekstra fetch yapma
    if (invoice) return;

    const fetchInvoice = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setError("You must be logged in to view this invoice.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const res = await fetch(
          `http://localhost:5050/api/orders/${orderId}/invoice`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await res.json();

        if (!res.ok) {
          setError(data.message || "Failed to load invoice.");
          setLoading(false);
          return;
        }

        setInvoice(data.invoice || data); // backend yapısına göre esnek
        setLoading(false);
      } catch (err) {
        console.error("FETCH INVOICE ERROR:", err);
        setError("An error occurred while loading the invoice.");
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [invoice, orderId]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleString();
  };

  if (loading) {
    return (
      <Container className="my-5">
        <div style={{ marginTop: "100px" }}></div>
        <Row className="justify-content-center">
          <Col md={6} className="text-center">
            <Spinner animation="border" role="status" className="mb-3" />
            <div>Loading invoice...</div>
          </Col>
        </Row>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="my-5">
        <div style={{ marginTop: "100px" }}></div>
        <Row className="justify-content-center">
          <Col md={8}>
            <Card className="shadow-sm">
              <Card.Body className="text-center">
                <Card.Title>Invoice Error</Card.Title>
                <p className="text-danger mt-3">{error}</p>
                <Button variant="dark" onClick={() => navigate("/orders")}>
                  Go to My Orders
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    );
  }

  if (!invoice) {
    return (
      <Container className="my-5">
        <div style={{ marginTop: "100px" }}></div>
        <Row className="justify-content-center">
          <Col md={8}>
            <Card className="shadow-sm">
              <Card.Body className="text-center">
                <Card.Title>No Invoice Data</Card.Title>
                <p className="mt-3">
                  Invoice details could not be found for this order.
                </p>
                <Button variant="dark" onClick={() => navigate("/")}>
                  Back to Home
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    );
  }

  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const shipping = invoice.shippingAddress || {};
  const totalAmount =
    typeof invoice.totalAmount === "number" ? invoice.totalAmount : 0;

  return (
    <Container className="my-5">
      <div style={{ marginTop: "100px" }}></div>
      <Row className="justify-content-center">
        <Col md={10} lg={8}>
          <Card className="shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h3 className="mb-1">Invoice</h3>
                  <div className="text-muted">
                    Invoice Number:{" "}
                    <strong>{invoice.invoiceNumber || "-"}</strong>
                  </div>
                  <div className="text-muted">
                    Date:{" "}
                    <strong>{formatDate(invoice.createdAt || invoice.date)}</strong>
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-muted">Order ID:</div>
                  <div className="fw-bold">{orderId}</div>
                  {invoice.trackingCode && (
                    <>
                      <div className="text-muted mt-2">Tracking Code:</div>
                      <div className="fw-bold">{invoice.trackingCode}</div>
                    </>
                  )}
                </div>
              </div>

              <hr />

              <Row className="mb-4">
                <Col md={6}>
                  <h5 className="mb-2">Bill To</h5>
                  <div>{shipping.name || "Customer"}</div>
                  {shipping.address && <div>{shipping.address}</div>}
                  {(shipping.city || shipping.postalCode) && (
                    <div>
                      {shipping.city} {shipping.postalCode}
                    </div>
                  )}
                </Col>
              </Row>

              <h5 className="mb-3">Order Items</h5>
              <Table bordered hover responsive size="sm">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Size</th>
                    <th className="text-end">Quantity</th>
                    <th className="text-end">Price</th>
                    <th className="text-end">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center">
                        No items found in this invoice.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => {
                      const qty = item.quantity || 0;
                      const price = item.price || 0;
                      const lineTotal = qty * price;

                      return (
                        <tr key={idx}>
                          <td>{item.name || item.productName || "Product"}</td>
                          <td>{item.size || item.variant || "-"}</td>
                          <td className="text-end">{qty}</td>
                          <td className="text-end">
                            {price.toFixed ? price.toFixed(2) : price} TL
                          </td>
                          <td className="text-end">
                            {lineTotal.toFixed(2)} TL
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </Table>

              <Row className="justify-content-end mt-3">
                <Col md={6} lg={4}>
                  <Card>
                    <Card.Body>
                      <div className="d-flex justify-content-between mb-2">
                        <span className="fw-bold">Total:</span>
                        <span className="fw-bold">
                          {totalAmount.toFixed(2)} TL
                        </span>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              <div className="mt-4 d-flex justify-content-between">
                <Button variant="outline-secondary" onClick={() => navigate("/")}>
                  Back to Home
                </Button>
                <Button variant="dark" onClick={() => navigate("/orders")}>
                  View My Orders
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default InvoicePage;
