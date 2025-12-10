// src/components/ProfilePage.js
import React, { useEffect, useState } from "react";
import "./ProfilePage.css";
import { useNavigate } from "react-router-dom";

function ProfilePage() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postalCode: ""
  });

  const token = localStorage.getItem("token");

  // Fetch profile data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:5050/api/users/me", {
          headers: { Authorization: `Bearer ${token}` }
        });

        const data = await res.json();
        if (res.ok) {
          setProfile({
            name: data.name || "",
            email: data.email || "",
            phone: data.phone || "",
            address: data.address || "",
            city: data.city || "",
            postalCode: data.postalCode || ""
          });
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchData();
  }, [token]);

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    try {
      const res = await fetch("http://localhost:5050/api/users/update", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(profile)
      });

      if (res.ok) alert("Profile updated successfully!");
      else alert("Update failed.");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="profile-page">
      
      {/* LEFT SIDEBAR */}
      <div className="profile-sidebar">
        <button onClick={() => navigate("/orders")}>Orders</button>
        <button>Returns</button>
        <button>Payment Methods</button>

        <button className="active">Profile</button>

        <button>Settings</button>
        <button>Favorites</button>

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

      {/* RIGHT PROFILE CONTENT */}
      <div className="profile-content">
        <h1 className="profile-name">{profile.name || "User"}</h1>

        {/* FIXED EMAIL DISPLAY */}
        <div className="profile-section">
          <label>Email Address</label>
          <p>{profile.email}</p>
        </div>

        <div className="profile-section">
          <label>Phone</label>
          <input
            name="phone"
            value={profile.phone}
            onChange={handleChange}
            placeholder="Phone"
          />
        </div>

        <div className="profile-section">
          <label>Address</label>
          <input
            name="address"
            value={profile.address}
            onChange={handleChange}
            placeholder="Address"
          />
        </div>

        <div className="profile-row">
          <div className="profile-section">
            <label>City</label>
            <input
              name="city"
              value={profile.city}
              onChange={handleChange}
              placeholder="City"
            />
          </div>

          <div className="profile-section">
            <label>Postal Code</label>
            <input
              name="postalCode"
              value={profile.postalCode}
              onChange={handleChange}
              placeholder="Postal Code"
            />
          </div>
        </div>

        <button className="save-btn" onClick={handleSave}>
          Save Changes
        </button>
      </div>
    </div>
  );
}

export default ProfilePage;
