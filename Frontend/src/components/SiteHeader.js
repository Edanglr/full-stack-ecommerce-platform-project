// src/components/SiteHeader.js
import React, { useState } from "react";
import { Navbar, Nav, NavDropdown, Container } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";

function SiteHeader({ user, onLogout, searchTerm, setSearchTerm }) {
  const navigate = useNavigate();
  const { cartCount } = useCart();

  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const categories = ["Sweatshirt", "T-shirt", "Short", "Jeans", "Knitwear"];

  const handleLogoutClick = () => {
    if (onLogout) onLogout();
    navigate("/");
  };

  // Kullanıcı baş harfi
  const getInitial = (name) => {
    if (!name) return "?";
    return name.trim().charAt(0).toUpperCase();
  };

  return (
    <Navbar
      bg="dark"
      variant="dark"
      expand="lg"
      fixed="top"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        width: "100%",
        zIndex: 1000,
      }}
      className="py-3"
    >
      <Container>
        <Navbar.Brand as={Link} to="/" className="d-flex align-items-center">
          <img
            src="/logo.png"
            width="42"
            height="42"
            className="d-inline-block align-top me-2"
            alt="La Strada Logo"
          />
          <span className="brand-name">La Strada</span>
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="main-navbar" />

        <Navbar.Collapse id="main-navbar">
          <Nav className="ms-auto align-items-center">
            {/* Search bar */}
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm || ""}
              onChange={(e) => setSearchTerm && setSearchTerm(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                marginRight: "15px",
                width: "180px",
              }}
            />

            {/* Categories */}
            <NavDropdown title="Categories" id="categories-dropdown">
              {categories.map((category) => (
                <NavDropdown.Item
                  key={category}
                  as={Link}
                  to={`/category/${category.toLowerCase().replace(" ", "-")}`}
                >
                  {category}
                </NavDropdown.Item>
              ))}
            </NavDropdown>

            {/* Manager: Comment Panel */}
            {user && user.role === "manager" && (
              <Nav.Link as={Link} to="/admin/comments" className="ms-3">
                Comment Panel
              </Nav.Link>
            )}

            {/* Track Order */}
            <Nav.Link
              as={Link}
              to="/track"
              className="ms-3"
              style={{ fontWeight: 600 }}
            >
              Track Order
            </Nav.Link>

            {/* Cart icon + count */}
            <Nav.Link as={Link} to="/cart" className="position-relative ms-3">
              <img
                src="/icons/cart-black.png"
                alt="cart"
                width="32"
                style={{ marginTop: "-2px" }}
              />
              {cartCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "-3px",
                    right: "-12px",
                    background: "white",
                    color: "black",
                    borderRadius: "50%",
                    fontSize: "12px",
                    fontWeight: "bold",
                    padding: "2px 6px",
                  }}
                >
                  {cartCount}
                </span>
              )}
            </Nav.Link>

            {/* USER AVATAR + DROPDOWN */}
            {user ? (
              <div
                className="nav-profile-wrapper ms-3"
                style={{ position: "relative" }}
              >
                <button
                  className="nav-profile-button"
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "50%",
                    background: "#222",
                    color: "white",
                    border: "none",
                    fontWeight: "bold",
                    fontSize: "16px",
                  }}
                >
                  {getInitial(user.name || user.fullName || user.email)}
                </button>

                {showProfileMenu && (
                  <div
                    className="nav-profile-dropdown"
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "48px",
                      background: "white",
                      borderRadius: "8px",
                      boxShadow: "0 3px 12px rgba(0,0,0,0.15)",
                      padding: "10px 0",
                      width: "160px",
                      display: "flex",
                      flexDirection: "column",
                      zIndex: 999,
                    }}
                  >
                    <button
                      onClick={() => navigate("/profile")}
                      style={{
                        padding: "10px 15px",
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Profilim
                    </button>

                    <button
                      onClick={() => navigate("/orders")}
                      style={{
                        padding: "10px 15px",
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Siparişlerim
                    </button>

                    <button
                      onClick={handleLogoutClick}
                      style={{
                        padding: "10px 15px",
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "red",
                      }}
                    >
                      Çıkış Yap
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Nav.Link as={Link} to="/login">
                  Log In
                </Nav.Link>
                <Nav.Link as={Link} to="/signup">
                  Sign Up
                </Nav.Link>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default SiteHeader;
