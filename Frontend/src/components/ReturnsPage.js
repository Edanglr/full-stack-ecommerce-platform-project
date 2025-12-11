// src/components/ReturnsPage.js
import React, { useEffect, useState } from "react";
import ProfileLayout from "./ProfileLayout";

function ReturnsPage() {
  const [returnsList, setReturnsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchExtraData = async (ret) => {
    try {
      const [orderRes, productRes] = await Promise.all([
        fetch(`http://localhost:5050/api/orders/${ret.orderId}`),
        fetch(`http://localhost:5050/api/products/${ret.productId}`)
      ]);

      const order = orderRes.ok ? await orderRes.json() : null;
      const product = productRes.ok ? await productRes.json() : null;

      return { ...ret, order, product };
    } catch (err) {
      console.error("EXTRA FETCH ERROR", err);
      return ret;
    }
  };

  useEffect(() => {
    const fetchReturns = async () => {
      try {
        const token = localStorage.getItem("token");

        const res = await fetch("http://localhost:5050/api/returns/my", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.message || "Failed to load your return requests.");
          setLoading(false);
          return;
        }

        const data = await res.json();

        // 🔥 Burada backend’in dönmediği order/product bilgilerini biz çekiyoruz
        const withDetails = await Promise.all(
          (data || []).map((ret) => fetchExtraData(ret))
        );

        setReturnsList(withDetails);
      } catch (err) {
        console.error("RETURNS FETCH ERROR:", err);
        setError("Unexpected error while loading return requests.");
      } finally {
        setLoading(false);
      }
    };

    fetchReturns();
  }, []);

  if (loading) {
    return (
      <ProfileLayout>
        <div style={{ padding: "20px" }}>Loading return requests...</div>
      </ProfileLayout>
    );
  }

  return (
    <ProfileLayout>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <h2>My Returns</h2>

        {returnsList.length === 0 && (
          <p>You have not requested any returns yet.</p>
        )}

        {returnsList.map((ret) => (
          <div
            key={ret._id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "10px",
              padding: "15px 20px",
              marginTop: "20px",
            }}
          >
            <h4 style={{ marginBottom: "10px" }}>Return #{ret._id}</h4>

            <p>
              <strong>Status:</strong>{" "}
              <span
                style={{
                  color:
                    ret.status === "Requested"
                      ? "orange"
                      : ret.status === "Approved"
                      ? "blue"
                      : ret.status === "Completed"
                      ? "green"
                      : "black",
                  fontWeight: 600,
                }}
              >
                {ret.status}
              </span>
            </p>

            <p>
              <strong>Reason:</strong> {ret.reason}
            </p>

            <p>
              <strong>Order ID:</strong> {ret.order?._id || ret.orderId}
            </p>

            <p>
              <strong>Product:</strong>{" "}
              {ret.product?.name || "Product not found"}
            </p>

            <p>
              <strong>Size:</strong> {ret.size}
            </p>

            <p>
              <strong>Quantity:</strong> {ret.quantity}
            </p>

            <p>
              <strong>Date:</strong>{" "}
              {new Date(ret.createdAt).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </ProfileLayout>
  );
}

export default ReturnsPage;
