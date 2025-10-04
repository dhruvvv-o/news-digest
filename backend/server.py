from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
import jwt
import feedparser
from bs4 import BeautifulSoup
import aiohttp
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 720  # 30 days

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class UserSignup(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    hashed_password: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    token: str

class UserPreferences(BaseModel):
    user_id: str
    categories: List[str] = []
    custom_rss_feeds: List[str] = []
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PreferencesUpdate(BaseModel):
    categories: List[str]

class RSSFeedAdd(BaseModel):
    feed_url: str

class NewsArticle(BaseModel):
    title: str
    link: str
    image: Optional[str] = None
    snippet: str
    published: Optional[str] = None
    source: str

class SummarizeRequest(BaseModel):
    article_url: str

class SummarizeResponse(BaseModel):
    summary: str

# Utility functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_jwt_token(user_id: str, email: str) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": expiration
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Google News RSS feeds by category
GOOGLE_NEWS_FEEDS = {
    "Tech": "https://news.google.com/rss/search?q=technology&hl=en-US&gl=US&ceid=US:en",
    "Sports": "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en",
    "Business": "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en",
    "Entertainment": "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNREpxYW5RU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en",
    "World": "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en",
    "Health": "https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtVnVLQUFQAQ?hl=en-US&gl=US&ceid=US:en",
    "Science": "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en",
}

async def fetch_rss_feed(feed_url: str, source_name: str = "RSS Feed") -> List[NewsArticle]:
    """Fetch and parse RSS feed"""
    try:
        feed = feedparser.parse(feed_url)
        articles = []
        
        for entry in feed.entries[:10]:  # Limit to 10 articles per feed
            # Extract image
            image_url = None
            if hasattr(entry, 'media_content') and entry.media_content:
                image_url = entry.media_content[0].get('url')
            elif hasattr(entry, 'media_thumbnail') and entry.media_thumbnail:
                image_url = entry.media_thumbnail[0].get('url')
            elif hasattr(entry, 'enclosures') and entry.enclosures:
                for enclosure in entry.enclosures:
                    if 'image' in enclosure.get('type', ''):
                        image_url = enclosure.get('href')
                        break
            
            # Extract snippet
            snippet = ""
            if hasattr(entry, 'summary'):
                soup = BeautifulSoup(entry.summary, 'html.parser')
                snippet = soup.get_text()[:300]
            elif hasattr(entry, 'description'):
                soup = BeautifulSoup(entry.description, 'html.parser')
                snippet = soup.get_text()[:300]
            
            article = NewsArticle(
                title=entry.get('title', 'No Title'),
                link=entry.get('link', ''),
                image=image_url,
                snippet=snippet,
                published=entry.get('published', ''),
                source=source_name
            )
            articles.append(article)
        
        return articles
    except Exception as e:
        logging.error(f"Error fetching RSS feed {feed_url}: {str(e)}")
        return []

async def extract_article_content(url: str) -> str:
    """Extract article content from URL"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')
                    
                    # Remove script and style elements
                    for script in soup(["script", "style", "nav", "footer", "header"]):
                        script.decompose()
                    
                    # Get text
                    text = soup.get_text()
                    lines = (line.strip() for line in text.splitlines())
                    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                    text = ' '.join(chunk for chunk in chunks if chunk)
                    
                    return text[:5000]  # Limit to 5000 chars
                else:
                    return ""
    except Exception as e:
        logging.error(f"Error extracting article content: {str(e)}")
        return ""

# Routes
@api_router.post("/auth/signup", response_model=UserResponse)
async def signup(user_data: UserSignup):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        email=user_data.email,
        name=user_data.name,
        hashed_password=hash_password(user_data.password)
    )
    
    await db.users.insert_one(user.dict())
    
    # Create default preferences
    preferences = UserPreferences(user_id=user.id)
    await db.preferences.insert_one(preferences.dict())
    
    # Generate token
    token = create_jwt_token(user.id, user.email)
    
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        token=token
    )

@api_router.post("/auth/login", response_model=UserResponse)
async def login(login_data: UserLogin):
    user = await db.users.find_one({"email": login_data.email})
    if not user or not verify_password(login_data.password, user['hashed_password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_jwt_token(user['id'], user['email'])
    
    return UserResponse(
        id=user['id'],
        email=user['email'],
        name=user['name'],
        token=token
    )

@api_router.get("/preferences")
async def get_preferences(current_user: dict = Depends(get_current_user)):
    prefs = await db.preferences.find_one({"user_id": current_user['user_id']})
    if not prefs:
        # Create default preferences
        prefs = UserPreferences(user_id=current_user['user_id'])
        await db.preferences.insert_one(prefs.dict())
    return prefs

@api_router.put("/preferences")
async def update_preferences(
    preferences: PreferencesUpdate,
    current_user: dict = Depends(get_current_user)
):
    await db.preferences.update_one(
        {"user_id": current_user['user_id']},
        {"$set": {
            "categories": preferences.categories,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"message": "Preferences updated"}

@api_router.post("/rss-feeds")
async def add_rss_feed(
    feed: RSSFeedAdd,
    current_user: dict = Depends(get_current_user)
):
    await db.preferences.update_one(
        {"user_id": current_user['user_id']},
        {"$addToSet": {"custom_rss_feeds": feed.feed_url}},
        upsert=True
    )
    return {"message": "RSS feed added"}

@api_router.delete("/rss-feeds")
async def remove_rss_feed(
    feed_url: str,
    current_user: dict = Depends(get_current_user)
):
    await db.preferences.update_one(
        {"user_id": current_user['user_id']},
        {"$pull": {"custom_rss_feeds": feed_url}}
    )
    return {"message": "RSS feed removed"}

@api_router.get("/news", response_model=List[NewsArticle])
async def get_news(current_user: dict = Depends(get_current_user)):
    # Get user preferences
    prefs = await db.preferences.find_one({"user_id": current_user['user_id']})
    if not prefs:
        return []
    
    all_articles = []
    
    # Fetch Google News for selected categories
    for category in prefs.get('categories', []):
        if category in GOOGLE_NEWS_FEEDS:
            articles = await fetch_rss_feed(GOOGLE_NEWS_FEEDS[category], category)
            all_articles.extend(articles)
    
    # Fetch custom RSS feeds
    for feed_url in prefs.get('custom_rss_feeds', []):
        articles = await fetch_rss_feed(feed_url, "Custom Feed")
        all_articles.extend(articles)
    
    return all_articles

@api_router.get("/news/search", response_model=List[NewsArticle])
async def search_news(query: str, current_user: dict = Depends(get_current_user)):
    # Google News search RSS
    search_url = f"https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"
    articles = await fetch_rss_feed(search_url, "Search Results")
    return articles

@api_router.post("/news/summarize", response_model=SummarizeResponse)
async def summarize_article(
    request: SummarizeRequest,
    current_user: dict = Depends(get_current_user)
):
    # Extract article content
    content = await extract_article_content(request.article_url)
    
    if not content:
        raise HTTPException(status_code=400, detail="Could not extract article content")
    
    # Use OpenAI GPT-5 to summarize
    try:
        chat = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id=f"summarize_{current_user['user_id']}_{uuid.uuid4()}",
            system_message="You are a helpful assistant that summarizes news articles concisely. Provide a clear, informative summary in 3-5 sentences."
        ).with_model("openai", "gpt-5")
        
        user_message = UserMessage(
            text=f"Please summarize this article:\n\n{content}"
        )
        
        summary = await chat.send_message(user_message)
        
        return SummarizeResponse(summary=summary)
    except Exception as e:
        logging.error(f"Error summarizing article: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to summarize article")

@api_router.get("/")
async def root():
    return {"message": "AI News Digest API"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()