import { useState } from "react";
import axios from "axios";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CATEGORIES = [
  { id: "Tech", label: "Technology", icon: "💻" },
  { id: "Sports", label: "Sports", icon: "⚽" },
  { id: "Business", label: "Business", icon: "💼" },
  { id: "Entertainment", label: "Entertainment", icon: "🎬" },
  { id: "World", label: "World News", icon: "🌍" },
  { id: "Health", label: "Health", icon: "🏥" },
  { id: "Science", label: "Science", icon: "🔬" },
];

export default function CategorySelector({ onComplete }) {
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleCategory = (categoryId) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSubmit = async () => {
    if (selectedCategories.length === 0) {
      setError("Please select at least one category");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await axios.put(`${API}/preferences`, {
        categories: selectedCategories,
      });
      onComplete();
    } catch (err) {
      setError("Failed to save preferences. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="category-selector-container" data-testid="category-selector-page">
      <div className="category-content">
        <Card className="category-card">
          <CardHeader>
            <CardTitle data-testid="category-title">Choose Your Interests</CardTitle>
            <CardDescription>
              Select the news categories you'd like to follow. You can change these later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="categories-grid">
              {CATEGORIES.map((category) => (
                <div
                  key={category.id}
                  data-testid={`category-${category.id.toLowerCase()}`}
                  className={`category-item ${
                    selectedCategories.includes(category.id) ? "selected" : ""
                  }`}
                  onClick={() => toggleCategory(category.id)}
                >
                  <Checkbox
                    checked={selectedCategories.includes(category.id)}
                    onCheckedChange={() => toggleCategory(category.id)}
                  />
                  <span className="category-icon">{category.icon}</span>
                  <span className="category-label">{category.label}</span>
                </div>
              ))}
            </div>

            {error && <div className="error-message" data-testid="category-error">{error}</div>}

            <Button
              onClick={handleSubmit}
              data-testid="category-submit-button"
              className="category-button"
              disabled={loading || selectedCategories.length === 0}
            >
              {loading ? "Saving..." : "Continue"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}