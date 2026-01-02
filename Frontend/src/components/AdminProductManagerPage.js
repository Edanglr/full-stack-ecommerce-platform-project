import React, { useEffect, useState } from "react";

function AdminProductManagerPage() {
  const [products, setProducts] = useState([]);

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    imageUrl: "",
    model: "",
    serialNumber: "",
    warrantyStatus: "",
    distributor: "",
    XS: 0,
    S: 0,
    M: 0,
    L: 0,
    XL: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("http://localhost:5050/api/products");

      if (!res.ok) {
        throw new Error("Failed to fetch products");
      }

      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch products error:", err);
      setError(err.message || "Error loading products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleStockChange = (size, value) => {
    setForm((prev) => ({ ...prev, [size]: Number(value) || 0 }));
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccessMsg("");

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
          model: form.model,
          serialNumber: form.serialNumber,
          warrantyStatus: form.warrantyStatus,
          distributor: form.distributor,
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
        setError(data.message || "Error creating product");
        return;
      }

      setSuccessMsg("Product created successfully!");

      setForm({
        name: "",
        description: "",
        price: "",
        category: "",
        imageUrl: "",
        model: "",
        serialNumber: "",
        warrantyStatus: "",
        distributor: "",
        XS: 0,
        S: 0,
        M: 0,
        L: 0,
        XL: 0,
      });

      await fetchProducts();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Create product error:", err);
      setError(err.message || "Unexpected error.");
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
    return (
      <div style={{ padding: "40px", textAlign: "center", marginTop: 80 }}>
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p style={{ marginTop: "10px" }}>Loading products...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, marginTop: 80 }}>
      <h2>Product Manager Panel</h2>

      {error && (
        <div
          style={{
            padding: "15px",
            marginTop: "15px",
            marginBottom: "20px",
            backgroundColor: "#fee",
            border: "1px solid #fcc",
            borderRadius: "8px",
            color: "#c33",
            maxWidth: 900,
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {successMsg && (
        <div
          style={{
            padding: "15px",
            marginTop: "15px",
            marginBottom: "20px",
            backgroundColor: "#d4edda",
            border: "1px solid #c3e6cb",
            borderRadius: "8px",
            color: "#155724",
            maxWidth: 900,
          }}
        >
          <strong>Success:</strong> {successMsg}
        </div>
      )}

      <h3>Add New Product</h3>

      <form onSubmit={handleCreateProduct} style={{ marginBottom: 30, maxWidth: 700 }}>
        <Field label="Name">
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            disabled={saving}
            style={{ width: "100%" }}
          />
        </Field>

        <Field label="Description">
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            disabled={saving}
            style={{ width: "100%", minHeight: 80 }}
          />
        </Field>

        <Field label="Price (TL)">
          <input
            type="number"
            name="price"
            value={form.price}
            onChange={handleChange}
            required
            disabled={saving}
            style={{ width: "100%" }}
          />
        </Field>

        <Field label="Category">
          <input
            type="text"
            name="category"
            value={form.category}
            onChange={handleChange}
            required
            disabled={saving}
            style={{ width: "100%" }}
          />
        </Field>

        <Field label="Image URL">
          <input
            type="text"
            name="imageUrl"
            value={form.imageUrl}
            onChange={handleChange}
            disabled={saving}
            style={{ width: "100%" }}
          />
        </Field>

        <Field label="Model">
          <input
            type="text"
            name="model"
            value={form.model}
            onChange={handleChange}
            required
            disabled={saving}
            style={{ width: "100%" }}
          />
        </Field>

        <Field label="Serial Number">
          <input
            type="text"
            name="serialNumber"
            value={form.serialNumber}
            onChange={handleChange}
            required
            disabled={saving}
            style={{ width: "100%" }}
          />
        </Field>

        <Field label="Warranty Status">
          <input
            type="text"
            name="warrantyStatus"
            value={form.warrantyStatus}
            onChange={handleChange}
            required
            disabled={saving}
            style={{ width: "100%" }}
          />
        </Field>

        <Field label="Distributor">
          <input
            type="text"
            name="distributor"
            value={form.distributor}
            onChange={handleChange}
            required
            disabled={saving}
            style={{ width: "100%" }}
          />
        </Field>

        <h4>Initial Stock per Size</h4>
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {["XS", "S", "M", "L", "XL"].map((size) => (
            <div key={size}>
              <label>{size}</label>
              <input
                type="number"
                value={form[size]}
                onChange={(e) => handleStockChange(size, e.target.value)}
                disabled={saving}
                style={{ width: 60 }}
              />
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "10px 20px",
            backgroundColor: saving ? "#ccc" : "black",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Create Product"}
        </button>
      </form>

      <h3>Existing Products</h3>

      {products.length === 0 ? (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            backgroundColor: "#f9f9f9",
            borderRadius: "8px",
            border: "1px solid #e5e5e5",
            maxWidth: 700,
          }}
        >
          <p style={{ fontSize: "18px", color: "#666" }}>
            No products found. Create your first product above!
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
          {products.map((p) => (
            <div
              key={p._id}
              style={{
                border: "1px solid #ccc",
                padding: 10,
                width: 250,
                borderRadius: "8px",
                backgroundColor: "white",
              }}
            >
              <img
                src={p.imageUrl || "https://via.placeholder.com/250x200?text=No+Image"}
                alt={p.name}
                style={{
                  width: "100%",
                  height: 200,
                  objectFit: "cover",
                  borderRadius: "4px",
                }}
              />

              <h4 style={{ marginTop: "10px", fontSize: "16px" }}>{p.name}</h4>
              <p style={{ margin: "5px 0" }}>{p.price} TL</p>
              <p style={{ margin: "5px 0", fontSize: "14px", color: "#666" }}>
                Category: {p.category}
              </p>

              <p style={{ fontSize: "13px", color: "#888" }}>Model: {p.model}</p>
              <p style={{ fontSize: "13px", color: "#888" }}>Serial: {p.serialNumber}</p>
              <p style={{ fontSize: "13px", color: "#888" }}>Warranty: {p.warrantyStatus}</p>
              <p style={{ fontSize: "13px", color: "#888" }}>Distributor: {p.distributor}</p>

              <p style={{ fontSize: "13px", marginTop: "8px" }}>
                Sizes:{" "}
                {["XS", "S", "M", "L", "XL"]
                  .map((s) => `${s}: ${(p.sizes && p.sizes[s]) || 0}`)
                  .join(" | ")}
              </p>

              <button
                onClick={() => handleDeleteProduct(p._id)}
                style={{
                  marginTop: "10px",
                  padding: "8px 16px",
                  backgroundColor: "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontWeight: "bold", display: "block", marginBottom: 4 }}>
        {label}
      </label>
      <div>{children}</div>
    </div>
  );
}

export default AdminProductManagerPage;
