import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import Auth from "./components/Auth";
import CategorySelector from "./components/CategorySelector";
import NewsFeed from "./components/NewsFeed";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Axios interceptor to add auth token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasCategories, setHasCategories] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      // Check if token is valid by fetching preferences
      const response = await axios.get(`${API}/preferences`);
      setIsAuthenticated(true);
      
      // Check if user has selected categories
      if (response.data.categories && response.data.categories.length > 0) {
        setHasCategories(true);
      }
    } catch (error) {
      localStorage.removeItem("token");
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = () => {
    setIsAuthenticated(true);
    checkAuth();
  };

  const handleCategoriesSelected = () => {
    setHasCategories(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
    setHasCategories(false);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              !isAuthenticated ? (
                <Auth onAuthSuccess={handleAuthSuccess} />
              ) : !hasCategories ? (
                <CategorySelector onComplete={handleCategoriesSelected} />
              ) : (
                <NewsFeed onLogout={handleLogout} />
              )
            }
          />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;