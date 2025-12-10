// src/components/ProductGrid.js
import React, { useEffect, useState } from "react";
import { Container, Row, Col, Card, Button } from "react-bootstrap";
import { Link } from "react-router-dom";

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

function ProductGrid({ searchTerm }) {
  const [products, setProducts] = useState([]);
  const [sortBy, setSortBy] = useState("newest");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ratingSummary, setRatingSummary] = useState({}); // {productId: {averageRating, ratingCount}}

  useEffect(() => {
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
        console.error("ProductGrid fetch error:", err);
        setError(err.message || "Error loading products");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // HER ÜRÜN İÇİN RATING ÖZETİ
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
        console.error("ProductGrid rating fetch error:", err);
      }
    };

    if (products.length > 0) {
      fetchRatingsForProducts();
    } else {
      setRatingSummary({});
    }
  }, [products]);

  const normalizedSearch = (searchTerm || "").trim().toLowerCase();

  const filteredAndSortedProducts = products
    .filter((product) => {
      if (!normalizedSearch) return true;

      const name = (product.name || "").toLowerCase();
      const description = (product.description || "").toLowerCase();
      const category = (product.category || "").toLowerCase();

      return (
        name.includes(normalizedSearch) ||
        description.includes(normalizedSearch) ||
        category.includes(normalizedSearch)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "priceAsc":
          return (a.price || 0) - (b.price || 0);
        case "priceDesc":
          return (b.price || 0) - (a.price || 0);
        case "popularity": {
          const aSummary = ratingSummary[a._id] || {};
          const bSummary = ratingSummary[b._id] || {};

          const aScore =
            (aSummary.averageRating || a.averageRating || 0) *
            (aSummary.ratingCount || a.ratingCount || 0);
          const bScore =
            (bSummary.averageRating || b.averageRating || 0) *
            (bSummary.ratingCount || b.ratingCount || 0);
          return bScore - aScore;
        }
        case "newest":
        default: {
          const aDate = a.createdAt ? new Date(a.createdAt) : 0;
          const bDate = b.createdAt ? new Date(b.createdAt) : 0;
          return bDate - aDate;
        }
      }
    });

  return (
    <Container style={{ marginTop: "40px", marginBottom: "40px" }}>
      <h2 className="text-center mb-3">All Products</h2>

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
          Increasing Price
        </Button>

        <Button
          variant={sortBy === "priceDesc" ? "dark" : "outline-dark"}
          size="sm"
          className="me-2"
          onClick={() => setSortBy("priceDesc")}
        >
          Decreasing Price
        </Button>

        <Button
          variant={sortBy === "popularity" ? "dark" : "outline-dark"}
          size="sm"
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
        {filteredAndSortedProducts.map((product) => {
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
              <Card className="h-100">
                <Link
                  to={`/product/${product._id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
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
                </Link>

                <Card.Body className="d-flex flex-column">
                  <Link
                    to={`/product/${product._id}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <Card.Title>{product.name}</Card.Title>
                  </Link>

                  <Card.Text>{product.price} TL</Card.Text>

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
                    >
                      Coming soon
                    </Button>
                  ) : (
                    <Button
                      as={Link}
                      to={`/product/${product._id}`}
                      variant="outline-dark"
                      className="mt-auto"
                    >
                      View Product
                    </Button>
                  )}
                </Card.Body>
              </Card>
            </Col>
          );
        })}

        {!loading && filteredAndSortedProducts.length === 0 && (
          <p className="text-center mt-4">No products found.</p>
        )}
      </Row>
    </Container>
  );
}

export default ProductGrid;
