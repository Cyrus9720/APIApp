let duelMovies = [];
let currentWinner = null;
let currentIndex = 0;
let roundNumber = 1;
let topGenre = "";

document.addEventListener("DOMContentLoaded", async function () {
    const messageEl = document.getElementById("duel-message");

    try {
        //here we fetch data from our api
        const response = await fetch("/api/duel");
        const data = await response.json();
        // if api didnt return ok, show msg
        if (data.status !== "ok") {
            messageEl.textContent = "Could not load duel right now.";
            return;
        }

        duelMovies = data.movies;
        topGenre = data.top_genre;
        //basic safety check
        if (!duelMovies || duelMovies.length < 2) {
            messageEl.textContent = "Not enough movies for a duel.";
            return;
        }
        //first movie becomes starting "winner"
        currentWinner = duelMovies[0];
        currentIndex = 1;

        showRound();
    } catch (err) {
        messageEl.textContent = "Something went wrong.";
    }
});

function showRound() {
    // Get elemets where movies and messages are shown
    const movie1El = document.getElementById("movie1");
    const movie2El = document.getElementById("movie2");
    const messageEl = document.getElementById("duel-message");

    if (currentIndex >= duelMovies.length) {
        showFinalWinner();
        return;
    }
    //current winner vs next movie in the list.
    const movie1 = currentWinner;
    const movie2 = duelMovies[currentIndex];

    movie1El.innerHTML = buildMovieCard(movie1, "left");
    movie2El.innerHTML = buildMovieCard(movie2, "right");
    //updates the number of the round: "3 of 5 - based on....."
    messageEl.textContent = "Round " + roundNumber + " of 5 - Based on your favorite genre: " + topGenre;
    
    const leftButton = document.getElementById("choose-left");
    const rightButton = document.getElementById("choose-right");
    //if a user picks the current winner, keep it
    leftButton.addEventListener("click", function () {
        currentWinner = movie1;
        currentIndex += 1;
        roundNumber += 1;
        showRound();
    });
    //if user picks the challenger, replace the winner
    rightButton.addEventListener("click", function () {
        currentWinner = movie2;
        currentIndex += 1;
        roundNumber += 1;
        showRound();
    });
}

function buildMovieCard(movie, buttonId) {
    //builds the HTML for one movie card (image, info, button)
    let html = "";

    //poster
    if (movie.poster_url) {
        html += '<img src="' + movie.poster_url + '" alt="' + movie.title + ' poster">';
    } else {
        html += '<div class="no-poster">No poster</div>';
    }

    //add movie info
    html += '<div class="movie-info">';
    html += '<h2>' + movie.title + '</h2>';
    html += '<p><strong>Release:</strong> ' + (movie.release_date || "Unknown") + '</p>';
    html += '<p><strong>Director:</strong> ' + (movie.director || "Unknown") + '</p>';
    html += '<p><strong>Rating:</strong> ' + (movie.rating || "N/A") + '</p>';
    html += '<button id="choose-' + buttonId + '" class="add-to-list-btn">Choose this movie</button>';
    html += '</div>';

    return html;
}

function showFinalWinner() {
    const duelContainer = document.getElementById("duel-container");
    const movie1El = document.getElementById("movie1");
    const movie2El = document.getElementById("movie2");
    const messageEl = document.getElementById("duel-message");

    //center winner, hide second card
    duelContainer.classList.add("duel-final");
    movie1El.classList.add("winner-card");

    movie1El.innerHTML = buildWinnerCard(currentWinner);
    movie2El.innerHTML = "";

    messageEl.textContent = "Your final winner is: " + currentWinner.title;
    
    const playAgainBtn = document.getElementById("play-again-btn");

    if (playAgainBtn) {
        playAgainBtn.addEventListener("click", function () {
            location.reload();
        });
    }
}

function buildWinnerCard(movie) {
    let html = "";

    if (movie.poster_url) {
        html += '<img src="' + movie.poster_url + '" alt="' + movie.title + ' poster">';
    } else {
        html += '<div class="no-poster">No poster</div>';
    }

    html += '<div class="movie-info">';
    html += '<h2>' + movie.title + '</h2>';
    html += '<p><strong>Release:</strong> ' + (movie.release_date || "Unknown") + '</p>';
    html += '<p><strong>Director:</strong> ' + (movie.director || "Unknown") + '</p>';
    html += '<p><strong>Rating:</strong> ' + (movie.rating || "N/A") + '</p>';


    html += '<div class="winner-label">Winner of the duel</div>';

    html += '<button id="play-again-btn" class="add-to-list-btn">Play again</button>';

    html += '</div>';

    return html;
}