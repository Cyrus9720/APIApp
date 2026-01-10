import json
import os
import httpx
from typing import List, Optional
from models import Movie, User
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("API_KEY")
BASE_URL = "https://api.themoviedb.org/3"
OMDB_API_KEY = os.getenv("OMDB_API_KEY")
DB_FILE = "users.json"

# --- DATABASE ---
def load_users() -> List[User]:
    if not os.path.exists(DB_FILE):
        return []
    try:
        with open(DB_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return [User(**u) for u in data]
    except:
        return []

def save_users(users: List[User]):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        # Pydantic model_dump to convert models to dicts
        json.dump([u.model_dump() for u in users], f, indent=2, ensure_ascii=False)

def get_user(username: str) -> Optional[User]:
    users = load_users()
    for user in users:
        if user.username == username:
            return user
    return None

def update_user_favorites(username: str, new_favorites: List[Movie]):
    users = load_users()
    for user in users:
        if user.username == username:
            user.favorites = new_favorites
            break
    save_users(users)

# --- TMDB & OMDB LOGIC (Async) ---
async def fetch_movie_details(client, movie_id):
    """HHelper function to fetch details (runtime/genres/director/omdb rating)"""
    resp = await client.get(f"{BASE_URL}/movie/{movie_id}", params={"api_key": API_KEY})
    if resp.status_code == 200:
        data = resp.json()
        
        # Fetch director from credits
        credits_resp = await client.get(f"{BASE_URL}/movie/{movie_id}/credits", params={"api_key": API_KEY})
        if credits_resp.status_code == 200:
            credits = credits_resp.json()
            crew = credits.get("crew", [])
            director = next((person["name"] for person in crew if person.get("job") == "Director"), None)
            data["director"] = director
        
        # Fetch OMDB rating via IMDb ID
        imdb_id = data.get("imdb_id")
        if imdb_id and OMDB_API_KEY:
            omdb_resp = await client.get("https://www.omdbapi.com/", params={"i": imdb_id, "apikey": OMDB_API_KEY})
            if omdb_resp.status_code == 200:
                omdb_data = omdb_resp.json()
                if "imdbRating" in omdb_data and omdb_data["imdbRating"] != "N/A":
                    try:
                        data["imdbRating"] = float(omdb_data["imdbRating"])
                    except:
                        pass
        
        return data
    return {}

async def search_movies_async(query: str) -> List[Movie]:
    if not query: 
        return []
    
    async with httpx.AsyncClient() as client:
        # 1. Search movies
        resp = await client.get(f"{BASE_URL}/search/movie", params={"api_key": API_KEY, "query": query})
        if resp.status_code != 200: return []
        
        results = resp.json().get("results", [])[:10] # Limit to 10
        movies = []

        # 2. Loop and build Movie objects
        for item in results:
            details = await fetch_movie_details(client, item["id"])
            
            movies.append(Movie(
                id=item["id"],
                title=item["title"],
                release_date=item.get("release_date", "Unknown"),
                rating=details.get("imdbRating") or item.get("vote_average", 0),
                poster_url=f"https://image.tmdb.org/t/p/w342{item['poster_path']}" if item.get('poster_path') else None,
                runtime=details.get("runtime", 0) or 0,
                genres=[g["name"] for g in details.get("genres", [])],
                director=details.get("director"),
            ))
        return movies

async def search_movies_by_director_async(director_name: str) -> List[Movie]:
    """Search for movies by director name"""
    if not director_name:
        return []
    
    async with httpx.AsyncClient() as client:
        # 1. Search for director
        person_resp = await client.get(f"{BASE_URL}/search/person", params={"api_key": API_KEY, "query": director_name})
        if person_resp.status_code != 200: return []
        
        people = person_resp.json().get("results", [])
        if not people: return []
        
        # Get the first person ID
        director_id = people[0].get("id")
        if not director_id: return []
        
        # 2. Search for movies by this director
        movies_resp = await client.get(f"{BASE_URL}/discover/movie", params={
            "api_key": API_KEY,
            "with_crew": director_id,
            "sort_by": "popularity.desc"
        })
        if movies_resp.status_code != 200: return []
        
        results = movies_resp.json().get("results", [])[:20]  
        movies = []
        
        for item in results:
            if len(movies) >= 10: 
                break
                
            details = await fetch_movie_details(client, item["id"])
            
            # Only include if the director fetched matches the search
            fetched_director = details.get("director")
            if fetched_director and director_name.lower() in fetched_director.lower():
                movies.append(Movie(
                    id=item["id"],
                    title=item["title"],
                    release_date=item.get("release_date", "Unknown"),
                    rating=details.get("imdbRating") or item.get("vote_average", 0),
                    poster_url=f"https://image.tmdb.org/t/p/w342{item['poster_path']}" if item.get('poster_path') else None,
                    runtime=details.get("runtime", 0) or 0,
                    genres=[g["name"] for g in details.get("genres", [])],
                    director=fetched_director,
                ))
        return movies

async def search_movies(query: str, search_type: str = "film") -> List[Movie]:
    """Unified search function that routes to title or director search"""
    if not query:
        return []
    
    if search_type == "director":
        return await search_movies_by_director_async(query)
    else:
        return await search_movies_async(query)

def calculate_wrapped_stats(favorites: List[Movie]) -> dict:
    """Calculate wrapped statistics from favorite movies"""
    if not favorites:
        return {
            "hours": 0,
            "minutes": 0,
            "total_movies": 0,
            "most_common_genre": None,
            "average_rating": 0,
            "rated_movies": 0
        }
    
    total_minutes = sum(m.runtime for m in favorites)
    
    all_genres = []
    for m in favorites:
        all_genres.extend(m.genres)
    
    from collections import Counter
    most_common = Counter(all_genres).most_common(1)
    top_genre = most_common[0][0] if most_common else "Unknown"
    
    avg_rating = sum(m.rating for m in favorites) / len(favorites)
    
    return {
        "hours": total_minutes // 60,
        "minutes": total_minutes % 60,
        "total_movies": len(favorites),
        "most_common_genre": top_genre,
        "average_rating": round(avg_rating, 1),
        "rated_movies": len(favorites)
    }