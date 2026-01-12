import React, { useEffect, useRef, useState } from "react";
import { Navbar, Nav, NavDropdown, Container } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";

function SiteHeader({ user, onLogout, searchTerm, setSearchTerm, hasNewSupportMessage }) {

  const navigate = useNavigate();
  const { cartCount } = useCart();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const closeTimeout = useRef(null);

  // ✅ FIX: categories artık backend'den gelecek
  const [categories, setCategories] = useState([]); // [{name, slug}] veya string list fallback

  // ✅ NEW: label'ı düzgün göster
  const toTitle = (s = "") => {
    const str = String(s || "").trim();
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch("http://localhost:5050/api/categories");
        const data = await res.json();

        if (!res.ok) return;

        // Yeni format: { items: [{name, slug}], categories: [...] }
        if (Array.isArray(data.items)) {
          setCategories(data.items);
          return;
        }

        // Eski format: { categories: ["sweatshirt", ...] }
        if (Array.isArray(data.categories)) {
          setCategories(
            data.categories.map((slug) => ({
              slug,
              name: slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : slug,
            }))
          );
          return;
        }

        setCategories([]);
      } catch (err) {
        console.error("SiteHeader categories fetch error:", err);
        setCategories([]);
      }
    };

    fetchCategories();
  }, []);

  const handleLogoutClick = () => {
    if (onLogout) onLogout();
    navigate("/");
  };

  const getInitial = (name) => {
    if (!name) return "?";
    return name.trim().charAt(0).toUpperCase();
  };

  const role = user?.role || "customer";

  // legacy manager her şeye erişsin
  const isLegacyManager = role === "manager";
  const isProductManager = role === "productManager" || isLegacyManager;
  const isSalesManager = role === "salesManager" || isLegacyManager;
  const isSupportAgent = role === "supportAgent" || isLegacyManager;

  // Ortak Buton Stili
  const dropdownButtonStyle = {
    padding: "10px 15px",
    background: "none",
    border: "none",
    textAlign: "left",
    cursor: "pointer",
    fontSize: "14px",
    width: "100%",
    color: "#333",
    transition: "background 0.2s",
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
        {/* LOGO */}
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
            {/* SEARCH BAR */}
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

            {/* ✅ CATEGORIES DROPDOWN (dynamic) */}
            <NavDropdown title="Categories" id="categories-dropdown">
              <NavDropdown.Item as={Link} to="/category/all">
                All
              </NavDropdown.Item>

              <NavDropdown.Divider />

              {categories.length === 0 ? (
                <NavDropdown.Item disabled>No categories</NavDropdown.Item>
              ) : (
                categories.map((c) => {
                  // c: {name, slug}
                  const slug =
                    typeof c === "string"
                      ? c.toLowerCase().replace(/\s+/g, "-")
                      : String(c.slug || "")
                          .toLowerCase()
                          .trim()
                          .replace(/\s+/g, "-");

                  const name =
                    typeof c === "string"
                      ? c
                      : String(c.name || c.slug || "").trim();

                  return (
                    <NavDropdown.Item
                      key={slug || name}
                      as={Link}
                      to={`/category/${encodeURIComponent(slug)}`}
                    >
                      {toTitle(name)}
                    </NavDropdown.Item>
                  );
                })
              )}
            </NavDropdown>

            {/* PRODUCT MANAGER LINKS */}
            {user && isProductManager && (
              <>
                <Nav.Link as={Link} to="/admin/products" className="ms-3">
                  Manage Products
                </Nav.Link>
                <Nav.Link as={Link} to="/admin/comments" className="ms-3">
                  Comment Panel
                </Nav.Link>
              </>
            )}

            {/* SALES MANAGER LINKS */}
            {user && isSalesManager && (
              <>
                <Nav.Link as={Link} to="/admin/orders" className="ms-3">
                  Manage Orders
                </Nav.Link>

                <Nav.Link as={Link} to="/admin/returns" className="ms-3">
                  Manage Returns
                </Nav.Link>

                <Nav.Link as={Link} to="/admin/invoices" className="ms-3">
                  Invoices
                </Nav.Link>

                <Nav.Link as={Link} to="/admin/analytics" className="ms-3">
                  Analytics
                </Nav.Link>
              </>
            )}

           
            {/* SUPPORT AGENT LINKS */}
            {user && isSupportAgent && (
              <Nav.Link
                as={Link}
                to="/admin/chats"
                className="ms-3"
                style={{ position: "relative", display: "inline-block" }}
              >
                Live Support

                {hasNewSupportMessage && (
                  <span
                    style={{
                      position: "absolute",
                      top: "2px",
                      right: "-6px",
                      width: "8px",
                      height: "8px",
                      backgroundColor: "#dc3545",
                      borderRadius: "50%",
                    }}
                  />
                )}
              </Nav.Link>
            )}


            {/* TRACK ORDER */}
            <Nav.Link
              as={Link}
              to={user && isProductManager ? "/admin/deliveries" : "/track"}
              className="ms-3"
              style={{ fontWeight: 600 }}
            >
              Track Order
            </Nav.Link>

            {/* CART ICON */}
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

            {/* USER AVATAR + HOVER MENU */}
            {user ? (
              <div
                className="nav-profile-wrapper ms-3"
                style={{ position: "relative" }}
                onMouseEnter={() => {
                  clearTimeout(closeTimeout.current);
                  setShowProfileMenu(true);
                }}
                onMouseLeave={() => {
                  closeTimeout.current = setTimeout(() => {
                    setShowProfileMenu(false);
                  }, 200);
                }}
              >
                <button
                  className="nav-profile-button"
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "50%",
                    background: "#222",
                    color: "white",
                    border: "none",
                    fontWeight: "bold",
                    fontSize: "16px",
                    cursor: "pointer",
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
                      width: "180px",
                      display: "flex",
                      flexDirection: "column",
                      zIndex: 999,
                    }}
                  >
                    {/* User Info Header: İsim öncelikli gösterim */}
                    <div
                      style={{
                        padding: "10px 15px",
                        borderBottom: "1px solid #eee",
                        marginBottom: "6px",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: "14px", color: "#000" }}>
                        {user.name || user.fullName || "User"}
                      </div>
                      <div style={{ fontSize: "12px", color: "#666" }}>
                        {user.email}
                      </div>
                    </div>

                    {/* Sadeleştirilmiş Menü Seçenekleri */}
                    <button onClick={() => navigate("/profile")} style={dropdownButtonStyle}>
                      Profile
                    </button>

                    <button onClick={() => navigate("/orders")} style={dropdownButtonStyle}>
                      My Orders
                    </button>

                    <button
                      onClick={handleLogoutClick}
                      style={{
                        ...dropdownButtonStyle,
                        color: "red",
                        borderTop: "1px solid #eee",
                        marginTop: "5px",
                      }}
                    >
                      Log Out
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
