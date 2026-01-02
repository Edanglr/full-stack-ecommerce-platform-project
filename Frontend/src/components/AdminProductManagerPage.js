import React, { useEffect, useMemo, useState } from "react";

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

  const [campaign, setCampaign] = useState({
    name: "",
    discountPercent: "",
    startDate: "",
    endDate: "",
  });

  const [selected, setSelected] = useState({});
  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected]
  );

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("http://localhost:5050/api/products");

      if (!res.ok) {
        throw new Error("Failed to fetch products");
      }

      const data = await res.json();
      setProducts(data);
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

  const toggleSelected = (productId) => {
    setSelected((prev) => ({ ...prev, [productId]: !prev[productId] }));
  };

  const selectAll = () => {
    const next = {};
    for (const p of products) next[p._id] = true;
    setSelected(next);
  };

  const clearSelection = () => {
    setSelected({});
  };

  const handleCampaignChange = (e) => {
    const { name, value } = e.target;
    setCampaign((prev) => ({ ...prev, [name]: value }));
  };

  const computePreviewPrice = (p) => {
    const base = Number(p.basePrice ?? p.originalPrice ?? p.price ?? 0);
    const percent = Number(campaign.discountPercent || 0);
    const rate = percent / 100;
    const discounted = Math.round(base * (1 - rate) * 100) / 100;
    return { base, discounted };
  };

  const handleCreateCampaign = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccessMsg("");

      if (!campaign.name.trim()) {
        setError("Campaign name is required");
        return;
      }
      if (selectedIds.length === 0) {
        setError("Select at least one product");
        return;
      }

      const percent = Number(campaign.discountPercent);
      if (!(percent > 0 && percent < 100)) {
        setError("Discount percent must be between 1 and 99");
        return;
      }

      if (!campaign.startDate || !campaign.endDate) {
        setError("Start date and end date are required");
        return;
      }

      const token = localStorage.getItem("token");

      const res = await fetch("http://localhost:5050/api/sales/discount-campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: campaign.name,
          productIds: selectedIds,
          discountRate: percent / 100,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Campaign creation failed");
        return;
      }

      setSuccessMsg(data.message || "Campaign created");
      setCampaign({ name: "", discountPercent: "", startDate: "", endDate: "" });
      clearSelection();
      await fetchProducts();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Create campaign error:", err);
      setError(err.message || "Unexpected error.");
    } finally {
      setSaving(false);
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

      <div style={{ marginBottom: 30, maxWidth: 900 }}>
        <h3>Discount Campaign</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Campaign Name">
            <input
              type="text"
              name="name"
              value={campaign.name}
              onChange={handleCampaignChange}
              disabled={saving}
              style={{ width: "100%" }}
            />
          </Field>

          <Field label="Discount Percent">
            <input
              type="number"
              name="discountPercent"
              value={campaign.discountPercent}
              onChange={handleCampaignChange}
              disabled={saving}
              style={{ width: "100%" }}
              min={1}
              max={99}
            />
          </Field>

          <Field label="Start Date">
            <input
              type="date"
              name="startDate"
              value={campaign.startDate}
              onChange={handleCampaignChange}
              disabled={saving}
              style={{ width: "100%" }}
            />
          </Field>

          <Field label="End Date">
            <input
              type="date"
              name="endDate"
              value={campaign.endDate}
              onChange={handleCampaignChange}
              disabled={saving}
              style={{ width: "100%" }}
            />
          </Field>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={selectAll}
            disabled={saving || products.length === 0}
            style={{
              padding: "10px 14px",
              backgroundColor: "#222",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Select All
          </button>

          <button
            type="button"
            onClick={clearSelection}
            disabled={saving}
            style={{
              padding: "10px 14px",
              backgroundColor: "#666",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Clear Selection
          </button>

          <button
            type="button"
            onClick={handleCreateCampaign}
            disabled={saving}
            style={{
              padding: "10px 14px",
              backgroundColor: saving ? "#ccc" : "black",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Create Campaign"}
          </button>

          <div style={{ marginLeft: "auto", color: "#555", alignSelf: "center" }}>
            Selected products: {selectedIds.length}
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div style={{ marginTop: 12, padding: 12, border: "1px solid #e5e5e5", borderRadius: 8 }}>
            <div style={{ fontWeight: "bold", marginBottom: 8 }}>Price Preview</div>
            {products
              .filter((p) => selected[p._id])
              .slice(0, 10)
              .map((p) => {
                const pr = computePreviewPrice(p);
                return (
                  <div key={p._id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ color: "#333" }}>{p.name}</div>
                    <div style={{ color: "#333" }}>
                      {pr.base} TL → {pr.discounted} TL
                    </div>
                  </div>
                );
              })}
            {selectedIds.length > 10 && (
              <div style={{ marginTop: 8, color: "#777" }}>
                Preview limited to 10 items
              </div>
            )}
          </div>
        )}
      </div>

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
                width: 270,
                borderRadius: "8px",
                backgroundColor: "white",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <label style={{ fontSize: 13, color: "#333" }}>
                  <input
                    type="checkbox"
                    checked={!!selected[p._id]}
                    onChange={() => toggleSelected(p._id)}
                    disabled={saving}
                    style={{ marginRight: 6 }}
                  />
                  Select
                </label>

                <div style={{ fontSize: 12, color: "#777" }}>
                  Base: {Number(p.basePrice ?? p.originalPrice ?? p.price ?? 0)} TL
                </div>
              </div>

              <img
                src={p.imageUrl || "https://via.placeholder.com/250x200?text=No+Image"}
                alt={p.name}
                style={{
                  width: "100%",
                  height: 200,
                  objectFit: "cover",
                  borderRadius: "4px",
                  marginTop: 8,
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
