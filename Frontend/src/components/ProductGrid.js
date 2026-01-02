// Frontend/src/components/ProductGrid.js
import React, { useEffect, useState } from "react";
import { Container, Row, Col, Card, Button } from "react-bootstrap";
import { Link } from "react-router-dom";

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
  const [ratingSummary, setRatingSummary] = useState({});

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

      {loading && (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p style={{ marginTop: "10px" }}>Loading products...</p>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "20px",
            margin: "0 auto 20px",
            maxWidth: "600px",
            backgroundColor: "#fee",
            border: "1px solid #fcc",
            borderRadius: "8px",
            color: "#c33",
            textAlign: "center",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
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

          const hasDiscount = Number(product.discountRate) > 0;
          const currentPrice = product.price;

          // ✅ BASE PRICE HER DURUMDA GARANTİLİ
          let basePrice = null;
          if (hasDiscount) {
            if (product.basePrice) {
              basePrice = Number(product.basePrice).toFixed(2);
            } else {
              basePrice = (
                currentPrice / (1 - Number(product.discountRate))
              ).toFixed(2);
            }
          }

          return (
            <Col key={product._id} md={4} sm={6} xs={12} className="mb-4">
              <Card className="h-100">
                <Link
                  to={`/product/${product._id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div style={{ position: "relative" }}>
                    <Card.Img
                      variant="top"
                      src={product.imageUrl}
                      alt={product.name}
                      onError={(e) => {
                        e.target.src =
                          "https://via.placeholder.com/300?text=No+Image";
                      }}
                    />

                    {hasDiscount && (
                      <span
                        style={{
                          position: "absolute",
                          top: "10px",
                          right: "10px",
                          backgroundColor: "#e74c3c",
                          color: "white",
                          padding: "6px 10px",
                          borderRadius: "4px",
                          fontSize: "14px",
                          fontWeight: "bold",
                        }}
                      >
                        {Math.round(product.discountRate * 100)}% OFF
                      </span>
                    )}
                  </div>
                </Link>

                <Card.Body className="d-flex flex-column">
                  <Link
                    to={`/product/${product._id}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <Card.Title>{product.name}</Card.Title>
                  </Link>

                  <Card.Text>
                    {hasDiscount ? (
                      <>
                        <span style={{ color: "#e74c3c", fontWeight: "bold" }}>
                          {currentPrice} TL
                        </span>
                        <span
                          style={{
                            textDecoration: "line-through",
                            color: "#999",
                            marginLeft: "8px",
                            fontSize: "14px",
                          }}
                        >
                          {basePrice} TL
                        </span>
                      </>
                    ) : (
                      <>{currentPrice} TL</>
                    )}
                  </Card.Text>

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
      </Row>
    </Container>
  );
}

export default ProductGrid;
