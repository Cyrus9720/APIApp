from __future__ import annotations
from pydantic import BaseModel, ConfigDict
from typing import List, Optional

class Movie(BaseModel):
    id: int
    title: str
    poster_url: Optional[str] = None
    release_date: Optional[str] = None
    rating: float = 0.0
    director: Optional[str] = None
    runtime: int = 0
    genres: List[str] = []
    imdbRating: Optional[float] = None  

class User(BaseModel):
    username: str
    password: str
    favorites: List[Movie] = []
    model_config = ConfigDict(from_attributes=True)

class WrappedStats(BaseModel):
    hours: int
    minutes: int
    total_movies: int
    average_rating: Optional[float] = None
    most_common_genre: Optional[str] = None
    taste_label: Optional[str] = None
    rated_movies: int = 0