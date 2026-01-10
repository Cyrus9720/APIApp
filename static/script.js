document.addEventListener("DOMContentLoaded", () => {
    const toastContainer = document.getElementById("toast-container");

    if (!toastContainer) return;

    function showToast(message, type = "info") {
        toastContainer.innerHTML = "";
        const toast = document.createElement("div");
        toast.classList.add("toast", `toast-${type}`);
        toast.textContent = message;
        toastContainer.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add("show"));
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 200);
        }, 2000);
    }

    // HANDLE LOGIN - intercept form and use API
    const indexForm = document.querySelector("form[method='post']");
    if (indexForm && window.location.pathname === "/") {
        indexForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = indexForm.querySelector("input[name='username']").value;
            const password = indexForm.querySelector("input[name='password']").value;
            
            const formData = new FormData();
            formData.append("username", username);
            formData.append("password", password);

            try {
                const response = await fetch("/api/auth/login", {
                    method: "POST",
                    body: formData,
                });
                if (response.ok) {
                    showToast("Logged in!");
                    setTimeout(() => window.location.href = "/movies", 500);
                } else {
                    const error = await response.json();
                    showToast(error.detail || "Login failed", "error");
                }
            } catch (err) {
                showToast("Network error", "error");
            }
        });
    }

    // HANDLE REGISTER - intercept form and use API
    const registerForm = document.querySelector("form[method='post'][action='/register']");
    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = registerForm.querySelector("input[name='username']").value;
            const password = registerForm.querySelector("input[name='password']").value;
            const confirm = registerForm.querySelector("input[name='confirm']").value;

            if (password !== confirm) {
                showToast("Passwords do not match", "error");
                return;
            }

            const formData = new FormData();
            formData.append("username", username);
            formData.append("password", password);

            try {
                const response = await fetch("/api/auth/register", {
                    method: "POST",
                    body: formData,
                });
                if (response.ok) {
                    showToast("Account created!");
                    setTimeout(() => window.location.href = "/movies", 500);
                } else {
                    const error = await response.json();
                    showToast(error.detail || "Registration failed", "error");
                }
            } catch (err) {
                showToast("Network error", "error");
            }
        });
    }

    // HANDLE SEARCH - intercept form and use API
    const searchForm = document.querySelector(".search-form");
    if (searchForm) {
        searchForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const query = searchForm.querySelector("input[name='q']").value;
            const type = searchForm.querySelector("select[name='type']").value;
            
            if (!query.trim()) {
                showToast("Enter a search query", "error");
                return;
            }

            try {
                const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=${type}`);
                const data = await response.json();
                updateSearchResults(data.movies);
            } catch (err) {
                showToast("Search failed", "error");
            }
        });
    }

    function updateSearchResults(movies) {
        let resultsDiv = document.querySelector(".results");
        if (!resultsDiv) {
            resultsDiv = document.createElement("div");
            resultsDiv.className = "results";
            document.querySelector(".container").appendChild(resultsDiv);
        }

        resultsDiv.innerHTML = movies.map(movie => `
            <div class="movie-card">
                ${movie.poster_url ? `<img src="${movie.poster_url}" alt="${movie.title}">` : '<div class="no-poster">No poster</div>'}
                <div class="movie-info">
                    <h2>${movie.title}</h2>
                    <p><strong>Release:</strong> ${movie.release_date || "Unknown"}</p>
                    <p><strong>Director:</strong> ${movie.director || "Unknown"}</p>
                    <p><strong>Rating:</strong> ${(movie.rating || 0).toFixed(1)}</p>
                    ${movie.runtime ? `<p><strong>Runtime:</strong> ${formatRuntime(movie.runtime)}</p>` : ''}
                    ${movie.genres && movie.genres.length ? `<p><strong>Genres:</strong> ${movie.genres.join(", ")}</p>` : ''}
                    <form class="add-to-list-form">
                        <input type="hidden" name="id" value="${movie.id}">
                        <input type="hidden" name="title" value="${movie.title}">
                        <input type="hidden" name="poster_url" value="${movie.poster_url || ''}">
                        <input type="hidden" name="release_date" value="${movie.release_date || ''}">
                        <input type="hidden" name="rating" value="${movie.rating || 0}">
                        <input type="hidden" name="director" value="${movie.director || ''}">
                        <input type="hidden" name="runtime" value="${movie.runtime || 0}">
                        <input type="hidden" name="genres" value="${movie.genres ? movie.genres.join(', ') : ''}">
                        <button type="submit" class="add-to-list-btn">Add to my list</button>
                    </form>
                </div>
            </div>
        `).join('');
        
        attachAddFavoriteListeners();
    }

    function formatRuntime(minutes) {
        if (!minutes) return "Unknown";
        const h = Math.floor(minutes / 60);
        const rem = minutes % 60;
        if (h === 0) return `${rem} min`;
        if (rem === 0) return `${h} h`;
        return `${h} h ${rem} min`;
    }

    function attachAddFavoriteListeners() {
        document.querySelectorAll(".add-to-list-form").forEach((form) => {
            form.removeEventListener("submit", handleAddFavorite);
            form.addEventListener("submit", handleAddFavorite);
        });
    }

    async function handleAddFavorite(e) {
        e.preventDefault();
        const formData = new FormData(this);
        try {
            const response = await fetch("/api/favorites", {
                method: "POST",
                body: formData,
            });
            const data = await response.json();
            if (response.ok) {
                showToast(data.status === "exists" ? "Already in your list" : "Added to your list!");
                // Reload favorites if on my_list page
                if (window.location.pathname === "/my_list") {
                    loadAndDisplayFavorites();
                }
            } else {
                showToast(data.detail || "Error adding movie", "error");
                console.error("Add favorite error:", data);
            }
        } catch (err) {
            showToast("Network error", "error");
            console.error("Add favorite network error:", err);
        }
    }

    function attachRemoveFavoriteListeners() {
        document.querySelectorAll(".remove-from-list-form").forEach((form) => {
            form.removeEventListener("submit", handleRemoveFavorite);
            form.addEventListener("submit", handleRemoveFavorite);
        });
    }

    async function handleRemoveFavorite(e) {
        e.preventDefault();
        const card = this.closest(".movie-card");
        const movieId = parseInt(this.querySelector("input[name='id']").value);
        
        card.classList.add("fade-out");
        try {
            const response = await fetch(`/api/favorites/${movieId}`, {
                method: "DELETE",
            });
            if (response.ok) {
                setTimeout(() => card.remove(), 200);
                showToast("Removed!");
            } else {
                card.classList.remove("fade-out");
                showToast("Error removing movie", "error");
            }
        } catch (err) {
            card.classList.remove("fade-out");
            showToast("Network error", "error");
        }
    }

    attachAddFavoriteListeners();
    attachRemoveFavoriteListeners();

    // Load favorites on my_list page
    if (window.location.pathname === "/my_list") {
        loadAndDisplayFavorites();
    }

    // Load wrapped stats on wrapped page
    if (window.location.pathname === "/wrapped") {
        loadAndDisplayWrapped();
    }

    async function loadAndDisplayFavorites() {
        try {
            const response = await fetch("/api/favorites");
            if (!response.ok) {
                showToast("Error loading favorites", "error");
                return;
            }
            const data = await response.json();
            displayFavorites(data.favorites);
        } catch (err) {
            showToast("Failed to load favorites", "error");
        }
    }

    function displayFavorites(favorites) {
        let resultsDiv = document.querySelector(".results");
        
        if (favorites.length === 0) {
            if (resultsDiv) resultsDiv.remove();
            const emptyMsg = document.querySelector("p");
            if (!emptyMsg) {
                const p = document.createElement("p");
                p.textContent = "You have no movies in your list yet. Go ahead and add some!";
                document.querySelector(".container").appendChild(p);
            }
            return;
        }

        if (!resultsDiv) {
            resultsDiv = document.createElement("div");
            resultsDiv.className = "results";
            document.querySelector(".container").appendChild(resultsDiv);
        }

        resultsDiv.innerHTML = favorites.map(movie => `
            <div class="movie-card">
                ${movie.poster_url ? `<img src="${movie.poster_url}" alt="${movie.title}">` : '<div class="no-poster">No poster</div>'}
                <div class="movie-info">
                    <h2>${movie.title}</h2>
                    <p><strong>Release:</strong> ${movie.release_date || "Unknown"}</p>
                    <p><strong>Director:</strong> ${movie.director || "Unknown"}</p>
                    <p><strong>Rating:</strong> ${(movie.rating || 0).toFixed(1)}</p>
                    ${movie.runtime ? `<p><strong>Runtime:</strong> ${formatRuntime(movie.runtime)}</p>` : ''}
                    ${movie.genres && movie.genres.length ? `<p><strong>Genres:</strong> ${movie.genres.join(", ")}</p>` : ''}
                    <form class="remove-from-list-form">
                        <input type="hidden" name="id" value="${movie.id}">
                        <button type="submit" class="remove-btn">Remove</button>
                    </form>
                </div>
            </div>
        `).join('');
        
        attachRemoveFavoriteListeners();
    }

    async function loadAndDisplayWrapped() {
        try {
            const response = await fetch("/api/wrapped");
            if (!response.ok) {
                showToast("Error loading stats", "error");
                return;
            }
            const stats = await response.json();
            updateWrappedDisplay(stats);
        } catch (err) {
            showToast("Failed to load wrapped stats", "error");
        }
    }

    function updateWrappedDisplay(stats) {
        // Update the wrapped page with actual stats from API
        // Find elements and update their content
        const container = document.querySelector(".container");
        
        if (!stats || stats.total_movies === 0) {
            showToast("No movies in your list yet", "info");
            return;
        }

        // Update hours display (usually in h1 or similar)
        const hourElements = document.querySelectorAll("[data-to]");
        hourElements.forEach(el => {
            if (el.textContent.includes("hour")) {
                el.textContent = stats.hours;
                el.dataset.to = stats.hours;
            }
        });

        // Look for the total movies count
        const movieCountElements = document.querySelectorAll("[data-to]");
        let foundMovieCount = false;
        movieCountElements.forEach((el, idx) => {
            if (!foundMovieCount && idx > 0) {
                el.textContent = stats.total_movies;
                el.dataset.to = stats.total_movies;
                foundMovieCount = true;
            }
        });

        // Update genre chip if present
        const genreChip = document.querySelector(".genre-chip");
        if (genreChip) {
            genreChip.textContent = stats.most_common_genre || "Unknown";
        }

        // Update rating display if present
        const ratingElements = document.querySelectorAll("h2, h3, p");
        ratingElements.forEach(el => {
            if (el.textContent.includes("rating") || el.textContent.includes("Rating")) {
                el.textContent = stats.average_rating.toFixed(1);
            }
        });

        // Update taste label
        const tierCard = document.querySelector(".tier-card");
        if (tierCard) {
            const tierText = tierCard.querySelector(".tier-text");
            if (tierText) {
                tierText.textContent = stats.taste_label;
            }
        }
    }
});
