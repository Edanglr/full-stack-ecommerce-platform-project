
// frontend/src/App.js

import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { CartProvider } from "./context/CartContext";

// component imports
import PaymentMethodsPage from "./components/PaymentMethodsPage";
import ReturnsPage from "./components/ReturnsPage";
import SettingsPage from "./components/SettingsPage";
import FavoritesPage from "./components/FavoritePage";

import ProfilePage from "./components/ProfilePage";
import TrackingPage from "./components/TrackingPage";
import SiteHeader from "./components/SiteHeader";
import HeroVideo from "./components/HeroVideo";
import ProductGrid from "./components/ProductGrid";
import LoginPage from "./components/LoginPage";
import SignupPage from "./components/SignupPage";
import CategoryPage from "./components/CategoryPage";
import CartPage from "./components/CartPage";
import ProductDetail from "./components/ProductDetail";
import AdminCommentsPage from "./components/AdminCommentsPage";
import OrderHistoryPage from "./components/OrderHistoryPage";

import AdminLiveChatPage from "./components/AdminLiveChatPage";
import AdminProductManagerPage from "./components/AdminProductManagerPage";
import AdminOrdersPage from "./components/AdminOrdersPage";

// ✅ from version-2
import AdminReturnsPage from "./components/AdminReturnsPage";
import AdminDeliveriesPage from "./components/AdminDeliveriesPage";

import InvoicePage from "./components/InvoicePage";
import PaymentPage from "./components/PaymentPage";

// 🔴 LIVE CHAT
import CustomerChat from "./components/chat/CustomerChat";

import AdminInvoicesPage from "./components/AdminInvoicesPage";
import SalesAnalyticsPage from "./components/SalesAnalyticsPage";

console.log("SiteHeader:", SiteHeader);
console.log("HeroVideo:", HeroVideo);
console.log("ProductGrid:", ProductGrid);
console.log("CustomerChat:", CustomerChat);

console.log("APP ROUTES LOADED!");

// ================= HomePage ==================
function HomePage({ searchTerm }) {
  return (
    <>
      <HeroVideo />
      <ProductGrid searchTerm={searchTerm} />
    </>
  );
}

/**
 * Route Guard:
 * - user yoksa -> /login
 * - role uymuyorsa -> / (home)
 * - manager (legacy) her şeye girer
 */
function RequireRole({ user, roles, children }) {
  if (!user) return <Navigate to="/login" replace />;

  const role = user.role;
  const allowed = roles.includes(role) || role === "manager"; // legacy super admin

  if (!allowed) return <Navigate to="/" replace />;

  return children;
}

// ✅ Login gerektiren sayfalar için guard
function RequireAuth({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// ==================== APP ====================
function App() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (err) {
        localStorage.removeItem("user");
      }
    }
  }, []);

  const handleLogin = (userData, token) => {
    setUser(userData);
    if (token) localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  return (
    <CartProvider>
      <Router>
        <div className="App">
          {/* HEADER */}
          <SiteHeader
            user={user}
            onLogout={handleLogout}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
          />

          {/* ROUTES */}
          <Routes>
            <Route path="/" element={<HomePage searchTerm={searchTerm} />} />
            <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/track" element={<TrackingPage />} />
            <Route path="/category/:categoryName" element={<CategoryPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/product/:id" element={<ProductDetail />} />

            {/* ✅ Customer pages (login required) */}
            <Route
              path="/profile"
              element={
                <RequireAuth user={user}>
                  <ProfilePage />
                </RequireAuth>
              }
            />
            <Route
              path="/payment-methods"
              element={
                <RequireAuth user={user}>
                  <PaymentMethodsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/returns"
              element={
                <RequireAuth user={user}>
                  <ReturnsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/settings"
              element={
                <RequireAuth user={user}>
                  <SettingsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/favorites"
              element={
                <RequireAuth user={user}>
                  <FavoritesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/orders"
              element={
                <RequireAuth user={user}>
                  <OrderHistoryPage />
                </RequireAuth>
              }
            />
            <Route
              path="/payment"
              element={
                <RequireAuth user={user}>
                  <PaymentPage />
                </RequireAuth>
              }
            />

            {/* ADMIN: Support Agent */}
            <Route
              path="/admin/chats"
              element={
                <RequireRole user={user} roles={["supportAgent"]}>
                  <AdminLiveChatPage user={user} />
                </RequireRole>
              }
            />

            {/* ADMIN: Product Manager */}
            <Route
              path="/admin/comments"
              element={
                <RequireRole user={user} roles={["productManager"]}>
                  <AdminCommentsPage />
                </RequireRole>
              }
            />

            <Route
              path="/admin/products"
              element={
                <RequireRole user={user} roles={["productManager"]}>
                  <AdminProductManagerPage />
                </RequireRole>
              }
            />

            {/* ✅ from version-2 */}
            <Route
              path="/admin/deliveries"
              element={
                <RequireRole user={user} roles={["productManager"]}>
                  <AdminDeliveriesPage />
                </RequireRole>
              }
            />

            {/* ADMIN: Sales Manager (+ Product Manager invoice/order visibility için) */}
            <Route
              path="/admin/orders"
              element={
                <RequireRole user={user} roles={["salesManager", "productManager"]}>
                  <AdminOrdersPage />
                </RequireRole>
              }
            />

            {/* ✅ from version-2 */}
            <Route
              path="/admin/returns"
              element={
                <RequireRole user={user} roles={["salesManager"]}>
                  <AdminReturnsPage />
                </RequireRole>
              }
            />

            {/* ✅ Invoice sayfası için de auth kontrolü eklendi */}
            <Route
              path="/invoice/:orderId"
              element={
                <RequireAuth user={user}>
                  <InvoicePage />
                </RequireAuth>
              }
            />
            
            <Route
              path="/admin/invoices"
              element={
                <RequireRole user={user} roles={["salesManager", "productManager"]}>
                  <AdminInvoicesPage />
                </RequireRole>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <RequireRole user={user} roles={["salesManager"]}>
                  <SalesAnalyticsPage />
                </RequireRole>
              }
            />
            
          </Routes>


          {/* ✅ GLOBAL LIVE CHAT (Guest + Logged-in herkeste görünür) */}
          <CustomerChat user={user} />
        </div>
      </Router>
    </CartProvider>
  );
}

export default App;
