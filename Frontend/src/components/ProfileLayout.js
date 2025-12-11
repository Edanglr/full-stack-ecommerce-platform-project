// src/components/ProfileLayout.js
import React from "react";
import { useNavigate } from "react-router-dom";
import "./ProfilePage.css"; // aynı CSS kullanılabilir

function ProfileLayout({ children }) {
  const navigate = useNavigate();

  return (
    <div className="profile-page">
      {/* LEFT SIDEBAR */}
      <div className="profile-sidebar">
        <button onClick={() => navigate("/orders")}>My Orders</button>
        <button onClick={() => navigate("/returns")}>My Returns</button>
        <button onClick={() => navigate("/payment-methods")}>
          Payment Methods
        </button>
        <button onClick={() => navigate("/profile")}>Profile</button>
        <button onClick={() => navigate("/settings")}>Settings</button>
        <button onClick={() => navigate("/favorites")}>Favorites</button>

        <button
          className="logout-btn"
          onClick={() => {
            localStorage.clear();
            navigate("/");
            window.location.reload();
          }}
        >
          Log Out
        </button>
      </div>

      {/* RIGHT SIDE PAGE CONTENT */}
      <div className="profile-content">
        {children}
      </div>
    </div>
  );
}

export default ProfileLayout;
