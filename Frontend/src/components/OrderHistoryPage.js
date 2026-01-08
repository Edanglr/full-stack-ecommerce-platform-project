// frontend/src/components/OrderHistoryPage.js
import React, { useEffect, useState } from "react";
import ProfileLayout from "./ProfileLayout";

function OrderHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creatingReturn, setCreatingReturn] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [downloadingInvoiceOrderId, setDownloadingInvoiceOrderId] = useState(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");
      if (!token) {
        setError("You must be logged in to view your orders.");
        setLoading(false);
        return;
      }

      const res = await fetch("http://localhost:5050/api/orders/my", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Failed to load your orders.");
        setLoading(false);
        return;
      }

      const data = await res.json();
      setOrders(data || []);
    } catch (err) {
      console.error("ORDER HISTORY ERROR:", err);
      setError("Unexpected error while loading orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleCreateReturn = async (order, item) => {
    if (creatingReturn) return;

    const confirm = window.confirm(
      `Do you want to request a return for "${item.name}"?`
    );
    if (!confirm) return;

    try {
      setCreatingReturn(true);
      const token = localStorage.getItem("token");
      if (!token) {
        alert("You must be logged in to request a return.");
        return;
      }

      const productId =
        item.productId?._id ||
        item.productId ||
        item.product?._id ||
        null;

      if (!productId) {
        alert("Product information is missing, cannot create return.");
        return;
      }

      const res = await fetch("http://localhost:5050/api/returns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: order._id,
          productId,
          size: item.size,
          quantity: item.quantity,
          reason: "Requested by customer",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.message || "Error creating return.");
        return;
      }

      alert("Return request created successfully.");
      fetchOrders();
    } catch (err) {
      console.error("CREATE RETURN ERROR:", err);
      alert("Unexpected error while creating return.");
    } finally {
      setCreatingReturn(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    const confirm = window.confirm(
      "Are you sure you want to cancel this order? This action cannot be undone."
    );
    if (!confirm) return;

    try {
      setCancellingOrderId(orderId);
      const token = localStorage.getItem("token");

      if (!token) {
        alert("You must be logged in to cancel orders.");
        return;
      }

      const res = await fetch(`http://localhost:5050/api/orders/${orderId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.message || "Failed to cancel order.");
        return;
      }

      alert("Order cancelled successfully. Stock has been restored.");
      fetchOrders();
    } catch (err) {
      console.error("CANCEL ORDER ERROR:", err);
      alert("Unexpected error while cancelling order.");
    } finally {
      setCancellingOrderId(null);
    }
  };

  const handleDownloadInvoicePdf = async (orderId) => {
    try {
      setDownloadingInvoiceOrderId(orderId);

      const token = localStorage.getItem("token");
      if (!token) {
        alert("You must be logged in to download invoices.");
        return;
      }

      const res = await fetch(
        `http://localhost:5050/api/orders/${orderId}/invoice/pdf`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "Failed to download invoice PDF.");
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("DOWNLOAD INVOICE PDF ERROR:", err);
      alert("Unexpected error while downloading invoice PDF.");
    } finally {
      setDownloadingInvoiceOrderId(null);
    }
  };

  if (loading) {
    return (
      <ProfileLayout>
        <div style={{ padding: "20px", textAlign: "center" }}>
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p style={{ marginTop: "10px" }}>Loading orders...</p>
        </div>
      </ProfileLayout>
    );
  }

  return (
    <ProfileLayout>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <h2 style={{ marginBottom: "20px" }}>My Orders</h2>

        {error && (
          <div
            style={{
              padding: "15px",
              marginBottom: "20px",
              backgroundColor: "#fee",
              border: "1px solid #fcc",
              borderRadius: "8px",
              color: "#c33",
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {!error && orders.length === 0 && (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              backgroundColor: "#f9f9f9",
              borderRadius: "8px",
              border: "1px solid #e5e5e5",
            }}
          >
            <p style={{ fontSize: "18px", color: "#666" }}>
              You don't have any orders yet.
            </p>
          </div>
        )}

        {orders.map((order) => {
          const canCancel = order.shippingStatus === "Processing";
          const canRequestReturn = order.shippingStatus === "Delivered";
          const canShowInvoiceButton =
            order.hasInvoicePdf === true || Boolean(order.invoiceNumber);

          return (
            <div
              key={order._id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "15px 20px",
                marginBottom: "20px",
                backgroundColor: "white",
              }}
            >
              <div style={{ marginBottom: "10px" }}>
                <strong>Order ID:</strong> {order._id}
                <br />
                <strong>Tracking Code:</strong> {order.trackingCode}
                <br />
                <strong>Date:</strong>{" "}
                {order.createdAt
                  ? new Date(order.createdAt).toLocaleString()
                  : "-"}
                <br />
                <strong>Status:</strong>{" "}
                <span
                  style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontWeight: "bold",
                    backgroundColor:
                      order.shippingStatus === "Delivered"
                        ? "#d4edda"
                        : order.shippingStatus === "In-transit"
                        ? "#d1ecf1"
                        : "#fff3cd",
                    color:
                      order.shippingStatus === "Delivered"
                        ? "#155724"
                        : order.shippingStatus === "In-transit"
                        ? "#0c5460"
                        : "#856404",
                  }}
                >
                  {order.shippingStatus || "Processing"}
                </span>
                <br />
                <strong>Total:</strong> {order.totalAmount} TL
                {order.invoiceNumber ? (
                  <>
                    <br />
                    <strong>Invoice Number:</strong> {order.invoiceNumber}
                  </>
                ) : null}
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {canShowInvoiceButton && (
                  <button
                    onClick={() => handleDownloadInvoicePdf(order._id)}
                    disabled={downloadingInvoiceOrderId === order._id}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "black",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor:
                        downloadingInvoiceOrderId === order._id
                          ? "not-allowed"
                          : "pointer",
                      opacity: downloadingInvoiceOrderId === order._id ? 0.6 : 1,
                    }}
                  >
                    {downloadingInvoiceOrderId === order._id
                      ? "Downloading..."
                      : "Download Invoice PDF"}
                  </button>
                )}

                {canCancel && (
                  <button
                    onClick={() => handleCancelOrder(order._id)}
                    disabled={cancellingOrderId === order._id}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#dc3545",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor:
                        cancellingOrderId === order._id
                          ? "not-allowed"
                          : "pointer",
                      opacity: cancellingOrderId === order._id ? 0.6 : 1,
                    }}
                  >
                    {cancellingOrderId === order._id
                      ? "Cancelling..."
                      : "Cancel Order"}
                  </button>
                )}
              </div>

              {order.shippingHistory && order.shippingHistory.length > 0 && (
                <>
                  <h5 style={{ marginTop: "10px" }}>Shipping History</h5>
                  <ul style={{ paddingLeft: "18px" }}>
                    {order.shippingHistory.map((entry, idx) => (
                      <li key={idx}>
                        {new Date(entry.date).toLocaleString()} —{" "}
                        <strong>{entry.status}</strong>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <h5 style={{ marginTop: "10px" }}>Items</h5>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {order.items.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "15px",
                      padding: "12px",
                      border: "1px solid #e5e5e5",
                      borderRadius: "6px",
                      backgroundColor: "#fafafa",
                      position: "relative",
                    }}
                  >
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        style={{
                          width: "80px",
                          height: "80px",
                          objectFit: "cover",
                          borderRadius: "4px",
                          flexShrink: 0,
                        }}
                        onError={(e) => {
                          e.target.src =
                            "https://via.placeholder.com/80?text=No+Image";
                        }}
                      />
                    )}

                    <div style={{ flex: 1 }}>
                      <p
                        style={{
                          margin: "0 0 4px 0",
                          fontWeight: "600",
                          fontSize: "15px",
                        }}
                      >
                        {item.name}
                      </p>
                      <p
                        style={{
                          margin: "0 0 2px 0",
                          fontSize: "14px",
                          color: "#666",
                        }}
                      >
                        Size: {item.size}, Qty: {item.quantity}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "14px",
                          fontWeight: "500",
                        }}
                      >
                        {item.price} TL
                      </p>
                    </div>

                    <button
                      onClick={() => handleCreateReturn(order, item)}
                      style={{
                        position: "absolute",
                        right: "10px",
                        bottom: "10px",
                        padding: "6px 12px",
                        fontSize: "12px",
                        backgroundColor: "black",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: canRequestReturn ? "pointer" : "not-allowed",
                        opacity: canRequestReturn ? 1 : 0.5,
                      }}
                      disabled={creatingReturn || !canRequestReturn}
                      title={
                        canRequestReturn
                          ? "Request a return"
                          : "Returns are only available for delivered orders"
                      }
                    >
                      {creatingReturn ? "Sending..." : "Return"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </ProfileLayout>
  );
}

export default OrderHistoryPage;
