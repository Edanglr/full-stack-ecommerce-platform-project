// Frontend/src/components/SignupPage.js
import React, { useState } from "react";
import { Card, Form, Button } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("http://localhost:5050/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.message || "Signup failed");
        return;
      }

      alert("Account created! Please log in.");
      navigate("/login");
    } catch (err) {
      console.error(err);
      setError("Network error");
    }
  };

  return (
    <div className="auth-page-container">
      <Card className="auth-form-card">
        <h2>Sign Up</h2>

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Full Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              placeholder="Enter email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Form.Group>

          {error && <p style={{ color: "red" }}>{error}</p>}

          <Button variant="dark" type="submit" className="w-100">
            Sign Up
          </Button>
        </Form>

        <div className="text-muted mt-3">
          Already have an account? <Link to="/login">Log In</Link>
        </div>
      </Card>
    </div>
  );
}

export default SignupPage;
