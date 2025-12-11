import React, { useEffect, useState } from "react";

function AdminProductManagerPage() {
  const [products, setProducts] = useState([]);

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    imageUrl: "",

    // REQUIREMENT 9
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
      [name]: value,
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

          // REQUIREMENT 9 fields
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
        alert(data.message || "Error creating product");
        return;
      }

      // Reset form
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
    } catch (err) {
      console.error("Create product error:", err);
      alert("Unexpected error.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm("Are you sure?")) return;

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
      alert("Unexpected error.");
    }
  };

  if (loading) return <p>Loading products...</p>;

  return (
    {/* 🔥 Sadece buraya marginTop eklendi */}
    <div style={{ padding: 20, marginTop: 120 }}>
      <h2>Product Manager Panel</h2>

      {/* ADD PRODUCT FORM */}
      <h3>Add New Product</h3>

      <form onSubmit={handleCreateProduct} style={{ marginBottom: 30 }}>
        {/* NAME */}
        <Field label="Name">
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
          />
        </Field>

        {/* DESCRIPTION */}
        <Field label="Description">
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
          />
        </Field>

        {/* PRICE */}
        <Field label="Price (TL)">
          <input
            type="number"
            name="price"
            value={form.price}
            onChange={handleChange}
            required
          />
        </Field>

        {/* CATEGORY */}
        <Field label="Category">
          <input
            type="text"
            name="category"
            value={form.category}
            onChange={handleChange}
            required
          />
        </Field>

        {/* IMAGE URL */}
        <Field label="Image URL">
          <input
            type="text"
            name="imageUrl"
            value={form.imageUrl}
            onChange={handleChange}
          />
        </Field>

        {/* REQUIREMENT 9 FIELDS */}
        <Field label="Model">
          <input
            type="text"
            name="model"
            value={form.model}
            onChange={handleChange}
            required
          />
        </Field>

        <Field label="Serial Number">
          <input
            type="text"
            name="serialNumber"
            value={form.serialNumber}
            onChange={handleChange}
            required
          />
        </Field>

        <Field label="Warranty Status">
          <input
            type="text"
            name="warrantyStatus"
            value={form.warrantyStatus}
            onChange={handleChange}
            required
          />
        </Field>

        <Field label="Distributor">
          <input
            type="text"
            name="distributor"
            value={form.distributor}
            onChange={handleChange}
            required
          />
        </Field>

        {/* SIZES */}
        <h4>Initial Stock per Size</h4>
        <div style={{ display: "flex", gap: 10 }}>
          {["XS", "S", "M", "L", "XL"].map((size) => (
            <div key={size}>
              <label>{size}</label>
              <input
                type="number"
                value={form[size]}
                onChange={(e) => handleStockChange(size, e.target.value)}
                style={{ width: 60 }}
              />
            </div>
          ))}
        </div>

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Create Product"}
        </button>
      </form>

      {/* EXISTING PRODUCTS */}
      <h3>Existing Products</h3>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        {products.map((p) => (
          <div
            key={p._id}
            style={{ border: "1px solid #ccc", padding: 10, width: 250 }}
          >
            <img
              src={
                p.imageUrl ||
                "https://via.placeholder.com/250x200?text=No+Image"
              }
              alt={p.name}
              style={{ width: "100%", height: 200, objectFit: "cover" }}
            />

            <h4>{p.name}</h4>
            <p>{p.price} TL</p>
            <p>Category: {p.category}</p>

            {/* Requirement 9 fields shown */}
            <p>Model: {p.model}</p>
            <p>Serial: {p.serialNumber}</p>
            <p>Warranty: {p.warrantyStatus}</p>
            <p>Distributor: {p.distributor}</p>

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

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontWeight: "bold" }}>{label}</label>
      <div>{children}</div>
    </div>
  );
}

export default AdminProductManagerPage;
