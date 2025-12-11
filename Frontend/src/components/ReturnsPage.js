// src/components/ReturnsPage.js
import React, { useEffect, useState } from "react";
import ProfileLayout from "./ProfileLayout";

function ReturnsPage() {
  const [returnsList, setReturnsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        setReturnsList(data || []);
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

        {error && (
          <p
            style={{ color: "red", fontWeight: "500", marginBottom: "15px" }}
          >
            {error}
          </p>
        )}

        {returnsList.length === 0 && !error && (
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
              <strong>Order ID:</strong>{" "}
              {ret.order?._id || ret.orderId || "N/A"}
            </p>

            <p>
              <strong>Product:</strong> {ret.product?.name || "N/A"}
            </p>

            <p>
              <strong>Size:</strong> {ret.size}
            </p>

            <p>
              <strong>Quantity:</strong> {ret.quantity}
            </p>

            <p>
              <strong>Date:</strong>{" "}
              {ret.createdAt
                ? new Date(ret.createdAt).toLocaleString()
                : "-"}
            </p>
          </div>
        ))}
      </div>
    </ProfileLayout>
  );
}

export default ReturnsPage;
