// APP.JS — BÜTÜN IMPORTLAR EN ÜSTE

import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
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

import InvoicePage from "./components/InvoicePage";
import PaymentPage from "./components/PaymentPage";

// 🔴 LIVE CHAT
import CustomerChat from "./components/chat/CustomerChat";

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

            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/payment-methods" element={<PaymentMethodsPage />} />
            <Route path="/returns" element={<ReturnsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/admin/chats" element={<AdminLiveChatPage user={user} />}/>
            <Route path="/orders" element={<OrderHistoryPage />} />
            <Route path="/admin/comments" element={<AdminCommentsPage />} />

            <Route path="/admin/products" element={<AdminProductManagerPage />} />
            <Route path="/admin/orders" element={<AdminOrdersPage />} />

            <Route path="/invoice/:orderId" element={<InvoicePage />} />
            <Route path="/payment" element={<PaymentPage />} />
          </Routes>

          {/* 🔴 GLOBAL LIVE CHAT (sadece login olmuş kullanıcı) */}
          {user && <CustomerChat user={user} />}

        </div>
      </Router>
    </CartProvider>
  );
}

export default App;