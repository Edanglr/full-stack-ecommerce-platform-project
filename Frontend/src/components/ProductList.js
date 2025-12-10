// frontend/src/components/ProductList.js
import React, { useEffect, useState } from "react";

function ProductList() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5050/api/products")
      .then((res) => res.json())
      .then((data) => setProducts(data))
      .catch((err) => console.log(err));
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h2>Products (Debug List)</h2>

      {products.length === 0 && <p>Loading...</p>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
        {products.map((p) => (
          <div
            key={p._id}
            style={{
              border: "1px solid gray",
              borderRadius: "10px",
              padding: "10px",
              width: "200px",
            }}
          >
            <img
              src={p.imageUrl}
              alt={p.name}
              style={{
                width: "100%",
                height: "180px",
                objectFit: "cover",
                borderRadius: "8px",
                marginBottom: "10px",
              }}
              onError={(e) => {
                e.target.src =
                  "https://via.placeholder.com/200?text=No+Image";
              }}
            />

            <h3 style={{ fontSize: "16px" }}>{p.name}</h3>
            <p>Price: {p.price}₺</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ProductList;
