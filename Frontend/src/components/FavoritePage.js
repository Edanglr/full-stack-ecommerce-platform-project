import React, { useEffect, useState } from "react";
import ProfileLayout from "./ProfileLayout";
import { Link } from "react-router-dom";

function FavoritesPage() {
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch("http://localhost:5050/api/favorites/my", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    setFavorites(data);
  };

  const removeFavorite = async (id) => {
    const token = localStorage.getItem("token");

    await fetch("http://localhost:5050/api/favorites/toggle", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ productId: id }),
    });

    loadFavorites();
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
          {favorites.map((fav) => (
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
                  alt=""
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
          ))}
        </div>
      </div>
    </ProfileLayout>
  );
}

export default FavoritesPage;
