// Frontend/src/components/FavoritePage.js
import React, { useEffect, useState } from "react";
import ProfileLayout from "./ProfileLayout";
import { Link, useNavigate } from "react-router-dom";

function FavoritesPage() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("token");

      const res = await fetch("http://localhost:5050/api/favorites/my", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.message || "Failed to load favorites");
        setLoading(false);
        return;
      }

      const data = await res.json();
      setFavorites(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Load favorites error:", err);
      setError("Network error while loading favorites");
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (productId) => {
    try {
      const token = localStorage.getItem("token");

      const res = await fetch("http://localhost:5050/api/favorites/toggle", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productId }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Failed to complete action");
        return;
      }

      loadFavorites();
    } catch (err) {
      console.error("Remove favorite error:", err);
      alert("Failed to complete action");
    }
  };

  if (loading) {
    return (
      <ProfileLayout>
        <div style={{ padding: "40px", textAlign: "center" }}>
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p style={{ marginTop: "10px" }}>Loading favorites...</p>
        </div>
      </ProfileLayout>
    );
  }

  return (
    <ProfileLayout>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <h2>My Favorites</h2>

        {/* ✅ TASK 2: Discount Notification Info Box */}
        <div
          style={{
            padding: "15px",
            marginTop: "15px",
            marginBottom: "20px",
            backgroundColor: "#d1ecf1",
            border: "1px solid #bee5eb",
            borderRadius: "8px",
            color: "#0c5460",
          }}
        >
          <strong>💡 Price Drop Alerts:</strong> You'll receive an email notification
          whenever a product in your favorites goes on sale!
        </div>

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

        {favorites.length === 0 && !error && (
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
              You have no favorite items yet.
            </p>
            <Link
              to="/"
              style={{
                marginTop: "10px",
                display: "inline-block",
                padding: "10px 20px",
                backgroundColor: "black",
                color: "white",
                textDecoration: "none",
                borderRadius: "6px",
              }}
            >
              Browse Products
            </Link>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: "20px",
            marginTop: "20px",
          }}
        >
          {favorites.map((fav) => {
            if (!fav.product) return null;

            // ✅ TASK 2: Discount display on favorite cards
            const hasDiscount = fav.product.discountRate && fav.product.discountRate > 0;
            const basePrice = fav.product.basePrice || fav.product.price;
            const currentPrice = fav.product.price;

            return (
              <div
                key={fav._id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "10px",
                  padding: "10px",
                  textAlign: "center",
                  backgroundColor: "white",
                  position: "relative",
                }}
              >
                {/* ✅ Discount badge */}
                {hasDiscount && (
                  <span
                    style={{
                      position: "absolute",
                      top: "10px",
                      right: "10px",
                      backgroundColor: "#e74c3c",
                      color: "white",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      zIndex: 1,
                    }}
                  >
                    {Math.round(fav.product.discountRate * 100)}% OFF
                  </span>
                )}

                <Link to={`/product/${fav.product._id}`}>
                  <img
                    src={fav.product.imageUrl}
                    alt={fav.product.name}
                    style={{
                      width: "100%",
                      borderRadius: "8px",
                      marginBottom: "10px",
                    }}
                    onError={(e) => {
                      e.target.src = "https://via.placeholder.com/180?text=No+Image";
                    }}
                  />
                  <h4 style={{ fontSize: "16px", marginBottom: "8px" }}>
                    {fav.product.name}
                  </h4>
                </Link>

                {/* ✅ TASK 2: Price with discount */}
                <div style={{ marginBottom: "10px" }}>
                  {hasDiscount ? (
                    <>
                      <p
                        style={{
                          color: "#e74c3c",
                          fontWeight: "bold",
                          margin: "0 0 4px 0",
                        }}
                      >
                        {currentPrice} TL
                      </p>
                      <p
                        style={{
                          textDecoration: "line-through",
                          color: "#999",
                          fontSize: "14px",
                          margin: 0,
                        }}
                      >
                        {basePrice} TL
                      </p>
                    </>
                  ) : (
                    <p style={{ margin: 0, fontWeight: "500" }}>
                      {currentPrice} TL
                    </p>
                  )}
                </div>

                <button
                  onClick={() => removeFavorite(fav.product._id)}
                  style={{
                    padding: "6px 12px",
                    background: "#dc3545",
                    color: "white",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </ProfileLayout>
  );
}

export default FavoritesPage;
