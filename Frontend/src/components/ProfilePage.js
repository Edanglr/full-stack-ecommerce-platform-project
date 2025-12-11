// src/components/ProfilePage.js
import React, { useEffect, useState } from "react";
import "./ProfilePage.css";
import ProfileLayout from "./ProfileLayout";

function ProfilePage() {
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postalCode: ""
  });

  const token = localStorage.getItem("token");

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
    <ProfileLayout>
      <h1 className="profile-name">{profile.name}</h1>

      <div className="profile-section">
        <label>Email Address</label>
        <p>{profile.email}</p>
      </div>

      <div className="profile-section">
        <label>Phone</label>
        <input name="phone" value={profile.phone} onChange={handleChange} />
      </div>

      <div className="profile-section">
        <label>Address</label>
        <input name="address" value={profile.address} onChange={handleChange} />
      </div>

      <div className="profile-row">
        <div className="profile-section">
          <label>City</label>
          <input name="city" value={profile.city} onChange={handleChange} />
        </div>

        <div className="profile-section">
          <label>Postal Code</label>
          <input
            name="postalCode"
            value={profile.postalCode}
            onChange={handleChange}
          />
        </div>
      </div>

      <button className="save-btn" onClick={handleSave}>
        Save Changes
      </button>
    </ProfileLayout>
  );
}

export default ProfilePage;
