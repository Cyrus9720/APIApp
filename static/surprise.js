document.addEventListener("DOMContentLoaded", async () => {
    const headerEl = document.getElementById("surprise-header");
    const movieEl = document.getElementById("surprise-movie");
    const noWrappedEl = document.getElementById("no-wrapped");

    try {
        const response = await fetch("/api/surprise");
        const data = await response.json();

        // No wrapped 
        if (data.status === "no_wrapped") {
            noWrappedEl.style.display = "block";
            noWrappedEl.classList.add("show");
            return;
        }

        // In case of nor esult for the genre ?
        if (data.status === "no_results") {
            headerEl.textContent = `Surprise! We got you covered!`;
            headerEl.classList.add("show");
            noWrappedEl.textContent = `No movies found for ${data.top_genre}.`;
            noWrappedEl.style.display = "block";
            noWrappedEl.classList.add("show");
            return;
        }

        // Normal case
        const topGenre = data.top_genre;
        const movie = data.movie;

        // Genre and their messages
        const messages = {
            "Action": "You seek the adrenaline? You got it!",
            "Horror": "Think you can handle this too?",
            "Romance": "Love is in the algorithm.",
            "Comedy": "Since everything is a joke to you!",
            "Adventure": "Prolong the adventures with this one here!"
        };

        const headerText = messages[topGenre] || "Surprise! We got you covered!";
        headerEl.textContent = headerText;
        headerEl.classList.add("show");

        // Build movie card
        movieEl.innerHTML = `
            <img src="${movie.poster_url || ''}" alt="${movie.title}">
            <h2>${movie.title}</h2>
            <p><strong>Release:</strong> ${movie.release_date || "Unknown"}</p>
            <p><strong>Director:</strong> ${movie.director || "Unknown"}</p>
            <p><strong>Rating:</strong> ${movie.rating ? movie.rating.toFixed(1) : "N/A"}</p>
            ${movie.runtime ? `<p><strong>Runtime:</strong> ${movie.runtime} min</p>` : ""}
            ${movie.genres && movie.genres.length ? `<p><strong>Genres:</strong> ${movie.genres.join(", ")}</p>` : ""}
        `;

        movieEl.classList.add("show");

    } catch (err) {
        noWrappedEl.textContent = "Something went wrong. Try again later.";
        noWrappedEl.style.display = "block";
        noWrappedEl.classList.add("show");
    }
});