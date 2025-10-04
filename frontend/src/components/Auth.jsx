import { useState } from "react";
import axios from "axios";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Auth({ onAuthSuccess, onClose }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/signup";
      const response = await axios.post(`${API}${endpoint}`, formData);

      localStorage.setItem("token", response.data.token);
      onAuthSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container" data-testid="auth-page">
      <div className="auth-content">
        <div className="auth-header">
          <h1 className="auth-title" data-testid="app-title">AI News Digest</h1>
          <p className="auth-subtitle">Stay informed with AI-powered news summaries</p>
          {onClose && (
            <button className="auth-close-button" onClick={onClose} data-testid="auth-close-button">
              ✕
            </button>
          )}
        </div>

        <Card className="auth-card">
          <CardHeader>
            <CardTitle data-testid="auth-card-title">{isLogin ? "Welcome Back" : "Create Account"}</CardTitle>
            <CardDescription>
              {isLogin
                ? "Sign in to access your personalized news feed"
                : "Sign up to get started with AI News Digest"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="auth-form">
              {!isLogin && (
                <div className="form-group">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    data-testid="signup-name-input"
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required={!isLogin}
                    placeholder="Enter your name"
                  />
                </div>
              )}

              <div className="form-group">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  data-testid="auth-email-input"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  placeholder="Enter your email"
                />
              </div>

              <div className="form-group">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  data-testid="auth-password-input"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                  placeholder="Enter your password"
                />
              </div>

              {error && <div className="error-message" data-testid="auth-error-message">{error}</div>}

              <Button
                type="submit"
                data-testid="auth-submit-button"
                className="auth-button"
                disabled={loading}
              >
                {loading ? "Please wait..." : isLogin ? "Sign In" : "Sign Up"}
              </Button>

              <div className="auth-toggle">
                <span>
                  {isLogin ? "Don't have an account?" : "Already have an account?"}
                </span>
                <button
                  type="button"
                  data-testid="auth-toggle-button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError("");
                  }}
                  className="toggle-link"
                >
                  {isLogin ? "Sign Up" : "Sign In"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}