import React, { useEffect, useState } from "react";

function AdminProductManagerPage() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    imageUrl: "",
    XS: 0,
    S: 0,
    M: 0,
    L: 0,
    XL: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch("http://localhost:5050/api/products");
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error("Fetch products error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "price" ? value : value,
    }));
  };

  const handleStockChange = (size, value) => {
    setForm((prev) => ({
      ...prev,
      [size]: Number(value) || 0,
    }));
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5050/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          price: Number(form.price),
          category: form.category,
          imageUrl: form.imageUrl,
          sizes: {
            XS: form.XS,
            S: form.S,
            M: form.M,
            L: form.L,
            XL: form.XL,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Error creating product");
        return;
      }

      // formu sıfırla
      setForm({
        name: "",
        description: "",
        price: "",
        category: "",
        imageUrl: "",
        XS: 0,
        S: 0,
        M: 0,
        L: 0,
        XL: 0,
      });

      await fetchProducts();
    } catch (err) {
      console.error("Create product error:", err);
      alert("Unexpected error while creating product.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5050/api/products/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Error deleting product");
        return;
      }

      await fetchProducts();
    } catch (err) {
      console.error("Delete product error:", err);
      alert("Unexpected error while deleting product.");
    }
  };

  if (loading) {
    return <p style={{ padding: 20 }}>Loading products...</p>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Product Management (Product Manager)</h2>

      {/* Yeni ürün formu */}
      <h3>Add New Product</h3>
      <form onSubmit={handleCreateProduct} style={{ marginBottom: 30 }}>
        <div style={fieldRow}>
          <label style={label}>Name</label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            style={input}
          />
        </div>
        <div style={fieldRow}>
          <label style={label}>Description</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            style={textarea}
          />
        </div>
        <div style={fieldRow}>
          <label style={label}>Price (TL)</label>
          <input
            type="number"
            name="price"
            value={form.price}
            onChange={handleChange}
            required
            style={input}
          />
        </div>
        <div style={fieldRow}>
          <label style={label}>Category</label>
          <input
            type="text"
            name="category"
            value={form.category}
            onChange={handleChange}
            required
            style={input}
          />
        </div>
        <div style={fieldRow}>
          <label style={label}>Image URL</label>
          <input
            type="text"
            name="imageUrl"
            value={form.imageUrl}
            onChange={handleChange}
            style={input}
          />
        </div>

        <h4>Initial Stock per Size</h4>
        <div style={fieldRow}>
          {["XS", "S", "M", "L", "XL"].map((size) => (
            <div key={size} style={{ marginRight: 10 }}>
              <label>{size}</label>
              <input
                type="number"
                value={form[size]}
                onChange={(e) => handleStockChange(size, e.target.value)}
                style={{ width: 60, marginLeft: 5 }}
              />
            </div>
          ))}
        </div>

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Create Product"}
        </button>
      </form>

      {/* Ürün listesi */}
      <h3>Existing Products</h3>
      {products.length === 0 && <p>No products yet.</p>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        {products.map((p) => (
          <div
            key={p._id}
            style={{
              border: "1px solid #ccc",
              borderRadius: 8,
              padding: 10,
              width: 250,
            }}
          >
            <img
              src={p.imageUrl || "https://via.placeholder.com/250x200?text=No+Image"}
              alt={p.name}
              style={{ width: "100%", height: 200, objectFit: "cover" }}
              onError={(e) => {
                e.target.src =
                  "https://via.placeholder.com/250x200?text=No+Image";
              }}
            />
            <h4>{p.name}</h4>
            <p>{p.price} TL</p>
            <p>Category: {p.category}</p>
            <p>
              Sizes:{" "}
              {["XS", "S", "M", "L", "XL"]
                .map((s) => `${s}: ${(p.sizes && p.sizes[s]) || 0}`)
                .join(" | ")}
            </p>
            <button onClick={() => handleDeleteProduct(p._id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const fieldRow = { marginBottom: 10, display: "flex", flexDirection: "column" };
const label = { fontWeight: "bold", marginBottom: 4 };
const input = { padding: 6 };
const textarea = { padding: 6, minHeight: 60 };

export default AdminProductManagerPage;
