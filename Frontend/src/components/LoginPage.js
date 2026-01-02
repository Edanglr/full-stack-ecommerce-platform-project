// Frontend/src/components/LoginPage.js
import React, { useState } from "react";
import { Card, Form, Button } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";

function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
const [error, setError] = useState("");
const [loading, setLoading] = useState(false);
const handleSubmit = async (e) => {
e.preventDefault();
setError("");
setLoading(true);
try {
  const res = await fetch("http://localhost:5050/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    setError(data.message || `Login failed (${res.status})`);
    setLoading(false);
    return;
  }

  const { token, user } = data;

  if (onLogin && user) {
    onLogin(user, token);
  }

  if (token) {
    localStorage.setItem("token", token);
  }
  if (user) {
    localStorage.setItem("user", JSON.stringify(user));
  }

  navigate("/");
} catch (err) {
  console.error(err);
  setError(err.message || "Network error. Please check your connection.");
  setLoading(false);
}
};
return (
<div className="auth-page-container">
<Card className="auth-form-card">
<div className="logo-container">
<img src="/logo.png" alt="Store Logo" />
</div>
<h2>Log In</h2>
    <Form onSubmit={handleSubmit}>
      <Form.Group className="mb-3" controlId="formBasicEmail">
        <Form.Label>Email address</Form.Label>
        <Form.Control
          type="email"
          placeholder="Enter email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
      </Form.Group>

      <Form.Group className="mb-3" controlId="formBasicPassword">
        <Form.Label>Password</Form.Label>
        <Form.Control
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
      </Form.Group>

      {error && (
        <div
          style={{
            padding: "12px",
            marginBottom: "15px",
            backgroundColor: "#fee",
            border: "1px solid #fcc",
            borderRadius: "8px",
            color: "#c33",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      <Button
        variant="dark"
        type="submit"
        className="btn-dark-custom w-100"
        disabled={loading}
      >
        {loading ? "Logging in..." : "Log In"}
      </Button>
    </Form>

    <div className="text-muted mt-3">
      Don't have an account? <Link to="/signup">Sign Up</Link>
    </div>
  </Card>
</div>
);
}
export default LoginPage;
