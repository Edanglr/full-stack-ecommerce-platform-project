import React, { useEffect, useState } from "react";
import ProfileLayout from "./ProfileLayout";
import { Link, useNavigate } from "react-router-dom";

function FavoritesPage() {
  const [favorites, setFavorites] = useState([]);
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
      const token = localStorage.getItem("token");

      const res = await fetch("http://localhost:5050/api/favorites/my", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.message || "Failed to load favorites");
        return;
      }

      const data = await res.json();
      setFavorites(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Load favorites error:", err);
      alert("Failed to load favorites");
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

  return (
    <ProfileLayout>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <h2>My Favorites</h2>

        {favorites.length === 0 && <p>You have no favorite items.</p>}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: "20px",
            marginTop: "20px",
          }}
        >
          {favorites.map((fav) => {
            if (!fav.product) return null; // 🛡️ crash guard

            return (
              <div
                key={fav._id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "10px",
                  padding: "10px",
                  textAlign: "center",
                }}
              >
                <Link to={`/product/${fav.product._id}`}>
                  <img
                    src={fav.product.imageUrl}
                    alt={fav.product.name}
                    style={{ width: "100%", borderRadius: "8px" }}
                  />
                  <h4>{fav.product.name}</h4>
                </Link>

                <p>{fav.product.price} TL</p>

                <button
                  onClick={() => removeFavorite(fav.product._id)}
                  style={{
                    padding: "6px 12px",
                    background: "red",
                    color: "white",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
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
