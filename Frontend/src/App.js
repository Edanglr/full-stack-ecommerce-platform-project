// src/App.js
import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { CartProvider } from "./context/CartContext";

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

// Ana sayfa bileşeni: video + ürün grid
function HomePage({ searchTerm }) {
  return (
    <>
      <HeroVideo />
      <ProductGrid searchTerm={searchTerm} />
    </>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Sayfa ilk açıldığında localStorage'dan kullanıcıyı oku
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

  // Login sonrası
  const handleLogin = (userData, token) => {
    setUser(userData);

    if (token) {
      localStorage.setItem("token", token);
    }
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
          <SiteHeader
            user={user}
            onLogout={handleLogout}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
          />

          <Routes>
            <Route path="/" element={<HomePage searchTerm={searchTerm} />} />
            <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/track" element={<TrackingPage />} />
            <Route path="/category/:categoryName" element={<CategoryPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/product/:id" element={<ProductDetail />} />

            {/* ⭐⭐ PROFIL SAYFASI BURADA EKLENDI ⭐⭐ */}
            <Route path="/profile" element={<ProfilePage />} />

            <Route path="/admin/comments" element={<AdminCommentsPage />} />
            <Route path="/orders" element={<OrderHistoryPage />} />
          </Routes>
        </div>
      </Router>
    </CartProvider>
  );
}

export default App;
