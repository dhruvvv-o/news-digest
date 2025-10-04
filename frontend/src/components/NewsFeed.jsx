import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import NewsCard from "./NewsCard";
import { Search, Settings, LogOut, Rss, Plus, Trash2 } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function NewsFeed({ onLogout }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState(null);
  const [newRssFeed, setNewRssFeed] = useState("");

  useEffect(() => {
    fetchNews();
    fetchPreferences();
  }, []);

  const fetchNews = async () => {
    try {
      const response = await axios.get(`${API}/news`);
      setArticles(response.data);
    } catch (error) {
      console.error("Failed to fetch news:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      const response = await axios.get(`${API}/preferences`);
      setPreferences(response.data);
    } catch (error) {
      console.error("Failed to fetch preferences:", error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await axios.get(`${API}/news/search`, {
        params: { query: searchQuery },
      });
      setArticles(response.data);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleAddRssFeed = async () => {
    if (!newRssFeed.trim()) return;

    try {
      await axios.post(`${API}/rss-feeds`, { feed_url: newRssFeed });
      setNewRssFeed("");
      fetchPreferences();
      fetchNews();
    } catch (error) {
      console.error("Failed to add RSS feed:", error);
    }
  };

  const handleRemoveRssFeed = async (feedUrl) => {
    try {
      await axios.delete(`${API}/rss-feeds`, { params: { feed_url: feedUrl } });
      fetchPreferences();
      fetchNews();
    } catch (error) {
      console.error("Failed to remove RSS feed:", error);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    fetchNews();
  };

  return (
    <div className="news-feed-container" data-testid="news-feed-page">
      {/* Header */}
      <header className="news-header">
        <div className="header-content">
          <h1 className="header-title" data-testid="news-header-title">AI News Digest</h1>
          <div className="header-actions">
            <Button
              variant="ghost"
              size="icon"
              data-testid="settings-button"
              onClick={() => setShowSettings(true)}
              className="header-button"
            >
              <Settings size={20} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              data-testid="logout-button"
              onClick={onLogout}
              className="header-button"
            >
              <LogOut size={20} />
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-container">
            <Search className="search-icon" size={20} />
            <Input
              type="text"
              data-testid="search-input"
              placeholder="Search news by topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button
                type="button"
                data-testid="clear-search-button"
                onClick={clearSearch}
                className="clear-search"
              >
                ✕
              </button>
            )}
          </div>
          <Button
            type="submit"
            data-testid="search-submit-button"
            disabled={searching || !searchQuery.trim()}
            className="search-button"
          >
            {searching ? "Searching..." : "Search"}
          </Button>
        </form>
      </header>

      {/* News Grid */}
      <main className="news-content">
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading your personalized news feed...</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="empty-state" data-testid="empty-news-state">
            <p>No articles found. Try adjusting your preferences or search for a topic.</p>
          </div>
        ) : (
          <div className="news-grid">
            {articles.map((article, index) => (
              <NewsCard key={index} article={article} />
            ))}
          </div>
        )}
      </main>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="settings-dialog" data-testid="settings-dialog">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Manage your news preferences and RSS feeds</DialogDescription>
          </DialogHeader>

          <div className="settings-content">
            <div className="settings-section">
              <h3 className="settings-section-title">Selected Categories</h3>
              <div className="categories-list">
                {preferences?.categories?.map((cat) => (
                  <span key={cat} className="category-badge">
                    {cat}
                  </span>
                ))}
              </div>
            </div>

            <div className="settings-section">
              <h3 className="settings-section-title">
                <Rss size={18} />
                Custom RSS Feeds
              </h3>
              <div className="rss-add-form">
                <Input
                  type="url"
                  data-testid="rss-feed-input"
                  placeholder="Enter RSS feed URL"
                  value={newRssFeed}
                  onChange={(e) => setNewRssFeed(e.target.value)}
                  className="rss-input"
                />
                <Button
                  onClick={handleAddRssFeed}
                  data-testid="add-rss-button"
                  disabled={!newRssFeed.trim()}
                  className="rss-add-button"
                >
                  <Plus size={18} />
                  Add
                </Button>
              </div>

              <div className="rss-feeds-list">
                {preferences?.custom_rss_feeds?.length === 0 ? (
                  <p className="no-feeds-text">No custom RSS feeds added yet</p>
                ) : (
                  preferences?.custom_rss_feeds?.map((feed) => (
                    <div key={feed} className="rss-feed-item" data-testid="rss-feed-item">
                      <span className="rss-feed-url">{feed}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid="remove-rss-button"
                        onClick={() => handleRemoveRssFeed(feed)}
                        className="rss-remove-button"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}