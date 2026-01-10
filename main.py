import uvicorn
import os
from collections import Counter
from fastapi import FastAPI, Request, Form, Depends, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware 

from models import Movie, User, WrappedStats
from services import load_users, save_users, get_user, update_user_favorites, search_movies, calculate_wrapped_stats

app = FastAPI()

app.add_middleware(SessionMiddleware, secret_key=os.getenv("SECRET_KEY", "hemlig-nyckel"), max_age=3600)

# 2. Setup Static files & Templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# 3. Register filter (format_runtime) to Jinja2
def format_runtime(minutes):
    if not minutes: return "Unknown"
    m = int(minutes)
    h = m // 60
    rem = m % 60
    if h == 0: return f"{rem} min"
    if rem == 0: return f"{h} h"
    return f"{h} h {rem} min"

templates.env.filters["format_runtime"] = format_runtime

# --- HELPER FUNCTION: Get current logged-in user ---
def get_current_user(request: Request):
    username = request.session.get("username")
    if not username:
        return None
    return get_user(username)

# --- ROUTES: PAGES (Return HTML) ---

@app.get("/")
def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/register")
def register_page(request: Request):
    return templates.TemplateResponse("register.html", {"request": request})

@app.post("/register")
async def register_action(request: Request, username: str = Form(...), password: str = Form(...), confirm: str = Form(...)):
    if password != confirm:
        return templates.TemplateResponse("register.html", {"request": request, "error": "Passwords mismatch"})
    
    if get_user(username):
        return templates.TemplateResponse("register.html", {"request": request, "error": "User exists"})
    
    users = load_users()
    users.append(User(username=username, password=password))
    save_users(users)
    
    request.session["username"] = username
    return RedirectResponse(url="/movies", status_code=303)

@app.post("/") # Login action
async def login_action(request: Request, username: str = Form(...), password: str = Form(...)):
    user = get_user(username)
    if user and user.password == password:
        request.session["username"] = username
        return RedirectResponse(url="/movies", status_code=303)
    
    return templates.TemplateResponse("index.html", {"request": request, "error": "Invalid credentials"})

@app.get("/logout")
def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/", status_code=303)

@app.get("/movies")
async def movies_page(request: Request, q: str = "", type: str = "film"):
    user = get_current_user(request)
    if not user: return RedirectResponse("/")

    movies_list = []
    if q:
        movies_list = await search_movies(q, type)

    return templates.TemplateResponse("movies.html", {
        "request": request, 
        "movies": movies_list, 
        "query": q, 
        "username": user.username
    })

@app.get("/my_list")
def my_list_page(request: Request, sort: str = "added", reverse: bool = False):
    user = get_current_user(request)
    if not user: return RedirectResponse("/")
    
    favs = user.favorites
    
    # Sorting
    if sort == "rating":
        favs.sort(key=lambda x: x.rating, reverse=not reverse)
    elif sort == "release":
        favs.sort(key=lambda x: x.release_date or "", reverse=not reverse)
    elif reverse:
        favs.reverse()

    return templates.TemplateResponse("my_list.html", {
        "request": request, 
        "favorites": favs, 
        "username": user.username,
        "sort_by": sort,
        "reverse_sort": reverse
    })

@app.get("/wrapped")
def wrapped_page(request: Request):
    user = get_current_user(request)
    if not user: return RedirectResponse("/")
    
    favs = user.favorites
    if not favs:
        return templates.TemplateResponse("wrapped.html", {"request": request, "hours":0, "minutes":0, "total_movies":0})
    
    stats = calculate_wrapped_stats(favs)
    avg_rating = stats["average_rating"]
    
    return templates.TemplateResponse("wrapped.html", {
        "request": request,
        "hours": stats["hours"],
        "minutes": stats["minutes"],
        "total_movies": stats["total_movies"],
        "most_common_genre": stats["most_common_genre"],
        "average_rating": avg_rating,
        "taste_label": "You are a true connoisseur, hats off good man!" if avg_rating > 8.5 
        else  "You have good taste" if avg_rating > 6.5 else "I see you watch most things" 
        if avg_rating > 4.5 else "Bro, what are you watching?",
        "rated_movies": stats["rated_movies"]
    })

# --- API ENDPOINTS ---

@app.post("/add_favorite")
async def add_favorite_api(
    request: Request,
    # Receive the fields separately because JS sends FormData
    id: int = Form(...),
    title: str = Form(...),
    poster_url: str = Form(None),
    release_date: str = Form(None),
    rating: float = Form(0.0),
    director: str = Form(None),
    runtime: int = Form(0),
    genres: str = Form("") # Comes as string "Action, Drama"
):
    user = get_current_user(request)
    if not user: raise HTTPException(401, "Not logged in")

    # Check if it already exists
    if any(m.id == id for m in user.favorites):
        return JSONResponse({"status": "exists", "message": "Already in list"})

    genre_list = [g.strip() for g in genres.split(",")] if genres else []

    new_movie = Movie(
        id=id, title=title, poster_url=poster_url, 
        release_date=release_date, rating=rating, 
        director=director, runtime=runtime, genres=genre_list
    )

    user.favorites.append(new_movie)
    update_user_favorites(user.username, user.favorites)
    
    return JSONResponse({"status": "ok", "message": "Added"})

@app.post("/remove_favorite")
async def remove_favorite_api(request: Request, id: int = Form(...)):
    user = get_current_user(request)
    if not user: raise HTTPException(401)

    new_favs = [m for m in user.favorites if m.id != id]
    update_user_favorites(user.username, new_favs)
    
    return JSONResponse({"status": "ok", "message": "Removed"})

# --- JSON API ENDPOINTS ---

@app.get("/api/search")
async def api_search_movies(q: str = "", type: str = "film"):
    """Search movies via API. type can be 'film' or 'director'"""
    if not q:
        return {"movies": []}
    
    movies = await search_movies(q, type)
    return {"movies": [m.model_dump() for m in movies]}

@app.post("/api/register")
async def api_register(username: str = Form(...), password: str = Form(...)):
    """Register new user via API"""
    if get_user(username):
        raise HTTPException(400, "User already exists")
    
    users = load_users()
    users.append(User(username=username, password=password))
    save_users(users)
    return {"status": "ok", "message": "User created"}

@app.post("/api/login")
async def api_login(username: str = Form(...), password: str = Form(...)):
    """Loggin via API"""
    user = get_user(username)
    if not user or user.password != password:
        raise HTTPException(401, "Invalid credentials")
    return {"status": "ok", "username": username}

@app.get("/api/favorites")
async def api_get_favorites(request: Request):
    """Get user's favorites via API"""
    user = get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    return {"favorites": [m.model_dump() for m in user.favorites]}

@app.post("/api/favorites")
async def api_add_favorite(request: Request, id: int = Form(...), title: str = Form(...), rating: float = Form(...), release_date: str = Form(...)):
    """Add favorite via API"""
    user = get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    
    # Check if already exists
    if any(m.id == id for m in user.favorites):
        return JSONResponse({"status": "ok", "message": "Already in favorites"})
    
    movie = Movie(
        id=id, 
        title=title, 
        rating=rating, 
        release_date=release_date
    )
    user.favorites.append(movie)
    update_user_favorites(user.username, user.favorites)
    return {"status": "ok", "message": "Added to favorites"}

@app.delete("/api/favorites/{movie_id}")
async def api_remove_favorite(request: Request, movie_id: int):
    """Remove favorite via API"""
    user = get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    
    new_favs = [m for m in user.favorites if m.id != movie_id]
    update_user_favorites(user.username, new_favs)
    return {"status": "ok", "message": "Removed"}

@app.get("/api/wrapped")
async def api_get_wrapped(request: Request):
    """Get wrapped statistics via API"""
    user = get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    
    favs = user.favorites
    if not favs:
        return WrappedStats(
            hours=0,
            minutes=0,
            total_movies=0,
            most_common_genre=None,
            average_rating=0,
            taste_label="No movies yet",
            rated_movies=0
        )
    
    stats = calculate_wrapped_stats(favs)
    avg_rating = stats["average_rating"]
    
    return WrappedStats(
        hours=stats["hours"],
        minutes=stats["minutes"],
        total_movies=stats["total_movies"],
        most_common_genre=stats["most_common_genre"],
        average_rating=avg_rating,
        taste_label="You are a true connoisseur, hats off good man!" if avg_rating > 8.5 
        else  "You have good taste" if avg_rating > 6.5 else "I see you watch most things" 
        if avg_rating > 4.5 else "Bro, what are you watching?",
        rated_movies=stats["rated_movies"]
    )

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)