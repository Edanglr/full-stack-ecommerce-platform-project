// src/components/SettingsPage.js
import React, { useState } from "react";
import ProfileLayout from "./ProfileLayout";

function SettingsPage() {
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const token = localStorage.getItem("token");

  // ---------------- EMAIL UPDATE ----------------
  const updateEmail = async () => {
    if (!newEmail || !emailPassword) {
      alert("Please fill all fields.");
      return;
    }

    const res = await fetch("http://localhost:5050/api/users/change-email", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ newEmail, password: emailPassword }),
    });

    const data = await res.json();
    alert(res.ok ? "Email updated!" : data.message);
  };

  // ---------------- PASSWORD UPDATE ----------------
  const updatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert("Please fill all fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("New passwords do not match.");
      return;
    }

    const res = await fetch("http://localhost:5050/api/users/change-password", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    });

    const data = await res.json();
    alert(res.ok ? "Password updated!" : data.message);
  };

  // ---------------- UI ----------------
  return (
    <ProfileLayout>
      <div style={{ maxWidth: "650px", margin: "0 auto", padding: "20px" }}>
        
        {/* PAGE TITLE */}
        <h2 style={{ marginBottom: "25px", fontWeight: "600" }}>
          Account Settings
        </h2>

        {/* EMAIL CARD */}
        <div
          style={{
            background: "#fff",
            padding: "25px",
            borderRadius: "12px",
            boxShadow: "0 3px 12px rgba(0,0,0,0.08)",
            marginBottom: "30px",
          }}
        >
          <h3 style={{ marginBottom: "20px" }}>Change Email</h3>

          <label style={{ fontWeight: "500" }}>New Email</label>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="example@mail.com"
            style={inputStyle}
          />

          <label style={{ fontWeight: "500" }}>Password (for security)</label>
          <input
            type="password"
            value={emailPassword}
            onChange={(e) => setEmailPassword(e.target.value)}
            placeholder="Enter current password"
            style={inputStyle}
          />

          <button style={buttonPrimary} onClick={updateEmail}>
            Update Email
          </button>
        </div>

        {/* PASSWORD CARD */}
        <div
          style={{
            background: "#fff",
            padding: "25px",
            borderRadius: "12px",
            boxShadow: "0 3px 12px rgba(0,0,0,0.08)",
            marginBottom: "20px",
          }}
        >
          <h3 style={{ marginBottom: "20px" }}>Change Password</h3>

          <label style={{ fontWeight: "500" }}>Current Password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
            style={inputStyle}
          />

          <label style={{ fontWeight: "500" }}>New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            style={inputStyle}
          />

          <label style={{ fontWeight: "500" }}>Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            style={inputStyle}
          />

          <button style={buttonPrimary} onClick={updatePassword}>
            Update Password
          </button>
        </div>
      </div>
    </ProfileLayout>
  );
}

// -----------------------------------
// SHARED STYLES
// -----------------------------------
const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "8px",
  border: "1px solid #ddd",
  marginBottom: "15px",
  marginTop: "5px",
  background: "#f7f7f7",
  fontSize: "15px",
};

const buttonPrimary = {
  width: "100%",
  padding: "12px",
  background: "#000",
  color: "#fff",
  borderRadius: "8px",
  marginTop: "5px",
  cursor: "pointer",
  fontSize: "15px",
  border: "none",
};

export default SettingsPage;
