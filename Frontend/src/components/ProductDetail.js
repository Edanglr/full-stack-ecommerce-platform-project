// Frontend/src/components/ProductDetail.js
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./ProductDetail.css";
import { useCart } from "../context/CartContext";

function ProductDetail() {
  const { id } = useParams();

  const [product, setProduct] = useState(null);
  const [comments, setComments] = useState([]);

  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState(1);

  const [averageRating, setAverageRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [ratingMessage, setRatingMessage] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const { addToCart } = useCart();

  const [isFavorite, setIsFavorite] = useState(false);

  // ✅ Toggle: show all sizes' stock (click on status)
  const [showStockBreakdown, setShowStockBreakdown] = useState(false);

  useEffect(() => {
    const loadFavoriteStatus = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        const res = await fetch("http://localhost:5050/api/favorites/my", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        const productIds = data.map((f) => f.product._id);

        setIsFavorite(productIds.includes(id));
      } catch (err) {
        console.error("Favorite load error:", err);
      }
    };

    loadFavoriteStatus();
  }, [id]);

  const toggleFavorite = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please login to add favorites.");
      return;
    }

    const previousFavoriteState = isFavorite;

    setIsFavorite(!isFavorite);

    try {
      const res = await fetch("http://localhost:5050/api/favorites/toggle", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productId: id }),
      });

      if (!res.ok) {
        setIsFavorite(previousFavoriteState);
        const errorData = await res
          .json()
          .catch(() => ({ message: "Unknown error" }));
        console.error("Favorite toggle failed:", errorData);
        alert(`Failed to complete action: ${errorData.message || res.statusText}`);
        return;
      }

      const data = await res.json();
      console.log("Favorite API Response (Success):", data);
    } catch (err) {
      setIsFavorite(previousFavoriteState);
      console.error("Favorite toggle network error:", err);
      alert("Network error: Could not connect to the server.");
    }
  };

  useEffect(() => {
    const fetchProductAndComments = async () => {
      try {
        const res = await fetch(`http://localhost:5050/api/products/${id}`);

        if (!res.ok) {
          console.error("Product fetch error. Status:", res.status);
          setProduct(null);
          return;
        }

        const data = await res.json();
        const productData = data.product || data;

        if (
          !productData ||
          typeof productData !== "object" ||
          !productData._id
        ) {
          console.error("Invalid or missing product data received:", data);
          setProduct(null);
          return;
        }

        setProduct(productData);
        setComments(data.comments || []);
      } catch (err) {
        console.error("Product fetch network or parsing error:", err);
        setProduct(null);
      }
    };

    fetchProductAndComments();
  }, [id]);

  // RATING ÖZETİ GETİR
  useEffect(() => {
    const fetchRating = async () => {
      try {
        const res = await fetch(
          `http://localhost:5050/api/ratings/product/${id}`
        );
        if (!res.ok) return;
        const data = await res.json();
        setAverageRating(data.averageRating || 0);
        setRatingCount(data.ratingCount || 0);
      } catch (err) {
        console.error("Rating fetch error:", err);
      }
    };

    fetchRating();
  }, [id]);

  if (!product) {
    return <p style={{ padding: 20 }}>Loading product...</p>;
  }

  const sizes = ["XS", "S", "M", "L", "XL"];
  const sizeStocks = product.sizes || {};

  const totalStock = sizes.reduce((sum, s) => sum + (sizeStocks[s] || 0), 0);

  const selectedSizeStock =
    selectedSize && sizeStocks ? sizeStocks[selectedSize] ?? 0 : 0;

  // QUANTITY ARTIRMA/AZALTMA FONKSİYONLARI - STOK KONTROLÜ İLE
  const handleQuantityIncrease = () => {
    if (!selectedSize) {
      alert("Please select a size first.");
      return;
    }
    if (quantity < selectedSizeStock) {
      setQuantity((q) => q + 1);
    } else {
      alert(
        `Only ${selectedSizeStock} pieces available for size ${selectedSize}.`
      );
    }
  };

  const handleQuantityDecrease = () => {
    setQuantity((q) => Math.max(1, q - 1));
  };

  const handleAddToCart = () => {
    if (!selectedSize) {
      alert("Please select a size first.");
      return;
    }
    if (selectedSizeStock <= 0) {
      alert(`Size ${selectedSize} is out of stock.`);
      return;
    }
    if (quantity > selectedSizeStock) {
      alert(`Only ${selectedSizeStock} pieces left.`);
      return;
    }

    addToCart(product, quantity, selectedSize);
    alert("Product added to cart.");
  };

  // BUTON STATES
  const hasAnyStock = totalStock > 0;
  const hasSelectedSize = !!selectedSize;

  let addButtonDisabled = true;
  let addButtonLabel = "Please select a size";

  if (!hasAnyStock) {
    addButtonDisabled = true;
    addButtonLabel = "Out of stock";
  } else if (!hasSelectedSize) {
    addButtonDisabled = true;
    addButtonLabel = "Please select a size";
  } else if (selectedSizeStock <= 0) {
    addButtonDisabled = true;
    addButtonLabel = "Out of stock";
  } else {
    addButtonDisabled = false;
    addButtonLabel = "Add to Cart";
  }

  // Ortalama yıldızlar
  const renderAverageStars = (value) => {
    const rounded = Math.round(value || 0);
    return [...Array(5)].map((_, i) => (
      <span key={i} className={i < rounded ? "pd-star filled" : "pd-star"}>
        {i < rounded ? "★" : "☆"}
      </span>
    ));
  };

  // Etkileşimli yıldızlar
  const renderInteractiveStars = () => {
    return [...Array(5)].map((_, i) => {
      const index = i + 1;
      const filled = (hoverRating || userRating) >= index;
      return (
        <span
          key={i}
          className={filled ? "pd-star clickable filled" : "pd-star clickable"}
          onMouseEnter={() => setHoverRating(index)}
          onMouseLeave={() => setHoverRating(0)}
          onClick={() => setUserRating(index)}
        >
          {filled ? "★" : "☆"}
        </span>
      );
    });
  };

  const handleSubmitRating = async () => {
    if (!userRating) {
      setRatingMessage("Please select a star rating first.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setRatingMessage("You must be logged in to rate this product.");
      return;
    }

    setIsSubmittingRating(true);
    setRatingMessage("");

    try {
      const res = await fetch("http://localhost:5050/api/ratings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: id,
          score: userRating,
          comment: commentText,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setRatingMessage(data.message || "Could not submit rating.");
        return;
      }

      setAverageRating(data.averageRating || userRating);
      setRatingCount(data.ratingCount || 1);
      setRatingMessage(
        commentText.trim()
          ? "Your rating & comment have been saved. Comment awaits manager approval."
          : "Your rating has been saved. Thank you!"
      );

      setCommentText("");
      setUserRating(0);
      setHoverRating(0);

      if (data.comments) {
        setComments(data.comments);
      }
    } catch (err) {
      console.error("Rating submit error:", err);
      setRatingMessage("Unexpected error while sending rating.");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const getSizeStatus = () => {
    if (!selectedSize) return "";
    if (selectedSizeStock === 0) return "Coming soon";
    if (selectedSizeStock <= 3) return "Limited stock";
    return "Available";
  };

  const sizeStatus = getSizeStatus();

  return (
    <div className="product-page-wrapper">
      <div className="pd-container">
        <div className="pd-left">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="pd-image"
            onError={(e) => {
              e.target.src = "https://via.placeholder.com/500?text=No+Image";
            }}
          />
        </div>

        <div className="pd-right">
          {/* ⭐ Ürün adı + Favori kalp */}
          <div className="pd-title-row">
            <h1 className="pd-title">{product.name}</h1>

            <button className="favorite-btn" onClick={toggleFavorite}>
              {isFavorite ? "❤️" : "🤍"}
            </button>
          </div>

          {/* Rating Özeti */}
          <div className="pd-rating-block">
            <div className="pd-rating-summary">
              {renderAverageStars(averageRating)}
              <span className="pd-rating-text">
                {ratingCount > 0
                  ? `${averageRating.toFixed(1)} (${ratingCount} rating${
                      ratingCount > 1 ? "s" : ""
                    })`
                  : "No ratings yet"}
              </span>
            </div>
          </div>

          <p className="pd-price">{product.price} TL</p>

          {/* SIZE */}
          <label className="pd-label">Select Size</label>
          <select
            className="pd-select"
            value={selectedSize}
            onChange={(e) => {
              setSelectedSize(e.target.value);
              setQuantity(1);
              setShowStockBreakdown(false);
            }}
          >
            <option value="">Choose size</option>
            {sizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* ✅ Stock (old line back) + click breakdown */}
          {selectedSize && (
            <>
              <p
                className="pd-stock"
                onClick={() => setShowStockBreakdown((v) => !v)}
                style={{ cursor: "pointer" }}
                title="Click to show stock by size"
              >
                {sizeStatus} (click)
              </p>

              {/* ✅ Old behavior restored */}
              <p style={{ marginTop: "6px", fontSize: "0.9rem" }}>
                Stock for size {selectedSize}: {selectedSizeStock}
              </p>

              {/* Optional breakdown */}
              {showStockBreakdown && (
                <div style={{ marginTop: "6px", fontSize: "0.9rem" }}>
                  {sizes.map((s) => (
                    <div
                      key={s}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "4px 0",
                        borderBottom: "1px dashed #e6e6e6",
                      }}
                    >
                      <span>{s}</span>
                      <span>{sizeStocks[s] || 0}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* QUANTITY - STOK KONTROLÜ İLE */}
          <label className="pd-label">Quantity</label>
          <div className="pd-quantity">
            <button onClick={handleQuantityDecrease}>−</button>
            <span>{quantity}</span>
            <button onClick={handleQuantityIncrease}>+</button>
          </div>

          <button
            className="pd-add"
            onClick={handleAddToCart}
            disabled={addButtonDisabled}
          >
            {addButtonLabel}
          </button>

          <h3 className="pd-info-title">Product Information</h3>
          <p className="pd-info">{product.description}</p>

          {/* ✅ Requirement 9 fields (NO extra stock here) */}
          <div style={{ marginTop: "12px", fontSize: "0.95rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                borderBottom: "1px dashed #e6e6e6",
              }}
            >
              <b>ID</b>
              <span>{product._id}</span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                borderBottom: "1px dashed #e6e6e6",
              }}
            >
              <b>Model</b>
              <span>{product.model || "-"}</span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                borderBottom: "1px dashed #e6e6e6",
              }}
            >
              <b>Serial Number</b>
              <span>{product.serialNumber || "-"}</span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                borderBottom: "1px dashed #e6e6e6",
              }}
            >
              <b>Warranty Status</b>
              <span>{product.warrantyStatus || "-"}</span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
              }}
            >
              <b>Distributor</b>
              <span>{product.distributor || "-"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <div className="features-container">
        <div className="info-card">
          <img src="/icons/cotton.jpeg" className="info-icon" alt="Cotton" />
          <h4>100% Cotton</h4>
          <p>
            Every product you purchase from La Strada is made from 100% cotton
            fabrics. Wash inside out at 30°C.
          </p>
        </div>

        <div className="info-card">
          <img src="/icons/delivery.jpeg" className="info-icon" alt="Delivery" />
          <h4>Fast Delivery</h4>
          <p>Every order is shipped within 2 business days.</p>
        </div>

        <div className="info-card">
          <img src="/icons/size.jpeg" className="info-icon" alt="Size Chart" />
          <h4>Size Chart</h4>
          <p>Don't forget to check the size chart for each different fit.</p>
        </div>

        <div className="info-card">
          <img src="/icons/return.jpeg" className="info-icon" alt="Return" />
          <h4>Return Process</h4>
          <p>
            If you want to return your order, you can contact us within
            14 business days.
          </p>
        </div>
      </div>

      {/* YORUM BÖLÜMÜ */}
      <div className="comment-section">
        <h2>Customer Reviews</h2>

        <div className="add-comment-box">
          <h3>Add a Review</h3>

          <div className="pd-rating-user">
            <span>Your rating:</span>
            <div className="pd-rating-stars">{renderInteractiveStars()}</div>
          </div>

          <textarea
            className="comment-textarea"
            placeholder="Write a comment (optional)..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={3}
          />

          <button
            className="pd-rating-button"
            onClick={handleSubmitRating}
            disabled={isSubmittingRating}
          >
            {isSubmittingRating ? "Sending..." : "Submit Rating & Comment"}
          </button>

          {ratingMessage && (
            <p className="pd-rating-message">{ratingMessage}</p>
          )}

          <p className="pd-rating-note">
            You can rate and comment on this product only after an order
            containing it has been delivered.
          </p>
        </div>

        {comments.length === 0 && <p>No approved comments yet.</p>}

        {comments.map((c) => (
          <div key={c._id} className="comment-card">
            <strong>{c.userId?.name || c.userId?.email || "User"}</strong>
            <div className="comment-stars">{renderAverageStars(c.score)}</div>
            <p>{c.comment}</p>
            {c.createdAt && (
              <span className="comment-date">
                {new Date(c.createdAt).toLocaleString()}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ProductDetail;
