import { useState } from "react";
import axios from "axios";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { ExternalLink, Sparkles } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function NewsCard({ article }) {
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSummarize = async () => {
    if (summary) {
      setShowSummary(true);
      return;
    }

    setLoading(true);
    setError("");
    setShowSummary(true);

    try {
      const response = await axios.post(`${API}/news/summarize`, {
        article_url: article.link,
      });
      setSummary(response.data.summary);
    } catch (err) {
      setError("Failed to generate summary. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="news-card" data-testid="news-card">
        {article.image && (
          <div className="news-card-image-container">
            <img
              src={article.image}
              alt={article.title}
              className="news-card-image"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          </div>
        )}

        <CardHeader className="news-card-header">
          <div className="news-card-meta">
            <span className="news-category" data-testid="news-category">{article.category}</span>
          </div>
          <CardTitle className="news-card-title" data-testid="news-title">{article.title}</CardTitle>
          <CardDescription className="news-card-snippet" data-testid="news-snippet">
            {article.snippet} | {article.source}
          </CardDescription>
        </CardHeader>

        <CardContent className="news-card-actions">
          <Button
            variant="outline"
            data-testid="read-article-button"
            onClick={() => window.open(article.link, "_blank")}
            className="news-action-button"
          >
            <ExternalLink size={16} />
            Read Full Article
          </Button>
          <Button
            data-testid="summarize-article-button"
            onClick={handleSummarize}
            className="news-action-button summarize-button"
          >
            <Sparkles size={16} />
            AI Summary
          </Button>
        </CardContent>
      </Card>

      {/* Summary Dialog */}
      <Dialog open={showSummary} onOpenChange={setShowSummary}>
        <DialogContent className="summary-dialog" data-testid="summary-dialog">
          <DialogHeader>
            <DialogTitle data-testid="summary-dialog-title">AI Summary</DialogTitle>
            <DialogDescription className="summary-article-title">
              {article.title}
            </DialogDescription>
          </DialogHeader>

          <div className="summary-content">
            {loading ? (
              <div className="summary-loading">
                <div className="loading-spinner"></div>
                <p>Generating AI summary...</p>
              </div>
            ) : error ? (
              <div className="summary-error" data-testid="summary-error">
                <p>{error}</p>
                <Button onClick={handleSummarize} className="retry-button">
                  Retry
                </Button>
              </div>
            ) : (
              <div className="summary-text" data-testid="summary-text">{summary}</div>
            )}
          </div>

          <div className="summary-footer">
            <Button
              variant="outline"
              onClick={() => window.open(article.link, "_blank")}
              data-testid="summary-read-full-button"
              className="summary-read-button"
            >
              <ExternalLink size={16} />
              Read Full Article
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}