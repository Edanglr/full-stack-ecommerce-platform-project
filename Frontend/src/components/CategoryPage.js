// src/components/CategoryPage.js
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Button } from "react-bootstrap";

// Hem eski stock hem yeni sizes yapısıyla çalışsın
function getTotalStock(product) {
  if (product.sizes) {
    const sizeKeys = ["XS", "S", "M", "L", "XL"];
    return sizeKeys.reduce(
      (sum, key) => sum + (product.sizes[key] || 0),
      0
    );
  }
  if (typeof product.stock === "number") {
    return product.stock;
  }
  return 0;
}

function CategoryPage() {
  const { categoryName } = useParams();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [sortBy, setSortBy] = useState("newest");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ratingSummary, setRatingSummary] = useState({}); // {productId: {averageRating, ratingCount}}

  // ÜRÜNLERİ ÇEK
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();

        if (categoryName && categoryName !== "all") {
          params.append("category", categoryName);
        }

        if (sortBy) {
          params.append("sortBy", sortBy);
        }

        const res = await fetch(
          `http://localhost:5050/api/products?${params.toString()}`
        );

        if (!res.ok) {
          throw new Error("Failed to fetch products");
        }

        const data = await res.json();
        setProducts(data);
      } catch (err) {
        console.error("CategoryPage fetch error:", err);
        setError(err.message || "Error loading products");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [categoryName, sortBy]);

  // HER ÜRÜN İÇİN RATING ÖZETİNİ ÇEK
  useEffect(() => {
    const fetchRatingsForProducts = async () => {
      try {
        const entries = await Promise.all(
          products.map(async (p) => {
            try {
              const res = await fetch(
                `http://localhost:5050/api/ratings/product/${p._id}`
              );
              if (!res.ok) {
                return [p._id, { averageRating: 0, ratingCount: 0 }];
              }
              const data = await res.json();
              return [
                p._id,
                {
                  averageRating: data.averageRating || 0,
                  ratingCount: data.ratingCount || 0,
                },
              ];
            } catch {
              return [p._id, { averageRating: 0, ratingCount: 0 }];
            }
          })
        );

        const obj = {};
        for (const [id, stats] of entries) {
          obj[id] = stats;
        }
        setRatingSummary(obj);
      } catch (err) {
        console.error("CategoryPage rating fetch error:", err);
      }
    };

    if (products.length > 0) {
      fetchRatingsForProducts();
    } else {
      setRatingSummary({});
    }
  }, [products]);

  const handleCardClick = (productId) => {
    navigate(`/product/${productId}`);
  };

  const readableCategory =
    categoryName && categoryName !== "all"
      ? categoryName.charAt(0).toUpperCase() + categoryName.slice(1)
      : "All Products";

  return (
    <Container style={{ marginTop: "100px" }}>
      <h2 className="text-center mb-3">{readableCategory}</h2>

      <div className="d-flex justify-content-center mb-4">
        <Button
          variant={sortBy === "newest" ? "dark" : "outline-dark"}
          size="sm"
          className="me-2"
          onClick={() => setSortBy("newest")}
        >
          Newest
        </Button>

        <Button
          variant={sortBy === "priceAsc" ? "dark" : "outline-dark"}
          size="sm"
          className="me-2"
          onClick={() => setSortBy("priceAsc")}
        >
          Price ↑ (Low → High)
        </Button>

        <Button
          variant={sortBy === "priceDesc" ? "dark" : "outline-dark"}
          size="sm"
          className="me-2"
          onClick={() => setSortBy("priceDesc")}
        >
          Price ↓ (High → Low)
        </Button>

        <Button
          variant={sortBy === "popularity" ? "dark" : "outline-dark"}
          size="sm"
          className="me-2"
          onClick={() => setSortBy("popularity")}
        >
          Most Popular
        </Button>
      </div>

      {loading && <p className="text-center">Loading products...</p>}
      {error && (
        <p className="text-center" style={{ color: "red" }}>
          {error}
        </p>
      )}

      <Row>
        {products.map((product) => {
          const totalStock = getTotalStock(product);

          const summary = ratingSummary[product._id] || {};
          const averageRating =
            typeof summary.averageRating === "number"
              ? summary.averageRating
              : product.averageRating || 0;
          const ratingCount =
            typeof summary.ratingCount === "number"
              ? summary.ratingCount
              : product.ratingCount || 0;

          return (
            <Col key={product._id} md={4} sm={6} xs={12} className="mb-4">
              <Card
                style={{ cursor: "pointer", height: "100%" }}
                onClick={() => handleCardClick(product._id)}
              >
                <Card.Img
                  variant="top"
                  src={product.imageUrl}
                  alt={product.name}
                  onError={(e) => {
                    e.target.src =
                      "https://via.placeholder.com/300?text=No+Image";
                  }}
                />

                <Card.Body className="d-flex flex-column">
                  <Card.Title>{product.name}</Card.Title>
                  <Card.Text>{product.price}₺</Card.Text>

                  {/* Rating satırı */}
                  {ratingCount > 0 && (
                    <Card.Text style={{ fontSize: "0.9rem" }}>
                      ⭐ {averageRating.toFixed(1)} ({ratingCount})
                    </Card.Text>
                  )}

                  {totalStock === 0 ? (
                    <Button
                      variant="outline-dark"
                      disabled
                      className="mt-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Coming soon
                    </Button>
                  ) : (
                    <Button
                      variant="outline-dark"
                      className="mt-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/product/${product._id}`);
                      }}
                    >
                      View product
                    </Button>
                  )}
                </Card.Body>
              </Card>
            </Col>
          );
        })}

        {!loading && products.length === 0 && (
          <p className="text-center mt-4">
            No products found in this category.
          </p>
        )}
      </Row>
    </Container>
  );
}

export default CategoryPage;
