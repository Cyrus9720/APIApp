document.addEventListener("DOMContentLoaded", async () => {
  // Fetch real stats from API
  try {
    const response = await fetch("/api/wrapped");
    if (response.ok) {
      const stats = await response.json();
      updateWrappedWithRealData(stats);
    }
  } catch (err) {
    console.error("Failed to load wrapped stats:", err);
  }

  const slides = document.querySelectorAll(".slide");
  const dots = document.querySelectorAll(".dot");

  // Count-up animation (runs once per slide)
  function animateCount(el) {
    const target = Number(el.dataset.to || "0");
    if (el.dataset.done === "1") return;   // run once
    el.dataset.done = "1";

    const duration = 900;
    const start = performance.now();

    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const value = Math.floor(target * p);
      el.textContent = value;
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target;
    }
    requestAnimationFrame(tick);
  }

  // Mark slide active + run its animations
  let lastActiveSlide = null;
  let lastActiveDot = null;

  function activateSlide(slide) {
    // Only update if different slide
    if (lastActiveSlide === slide) return;

    if (lastActiveSlide) lastActiveSlide.classList.remove("is-active");
    slide.classList.add("is-active");
    lastActiveSlide = slide;

    // update dots efficiently
    const idx = Number(slide.dataset.slide) - 1;
    if (lastActiveDot) lastActiveDot.classList.remove("active");
    if (dots[idx]) {
      dots[idx].classList.add("active");
      lastActiveDot = dots[idx];
    }

    // run count-ups in this slide only
    slide.querySelectorAll(".count-up").forEach(animateCount);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        activateSlide(entry.target);
      }
    });
  }, { threshold: 0.6 });

  slides.forEach(slide => observer.observe(slide));

  // activate first slide immediately
  if (slides[0]) activateSlide(slides[0]);
});

function updateWrappedWithRealData(stats) {
  // Update hours in slide 1
  const hoursSpan = document.querySelector(".slide-1 .count-up[data-to]");
  if (hoursSpan) {
    hoursSpan.dataset.to = stats.hours;
    hoursSpan.textContent = stats.hours;
  }

  // Update total days
  const totalMinutes = (stats.hours * 60) + stats.minutes;
  const totalDays = (totalMinutes / 60) / 24;
  const daysSpan = document.querySelector(".count-up-days");
  if (daysSpan) {
    daysSpan.dataset.days = totalDays.toFixed(1);
    daysSpan.textContent = totalDays.toFixed(1);
  }

  // Update movie count in slide 2
  const moviesSpan = document.querySelector(".slide-2 .count-up[data-to]");
  if (moviesSpan) {
    moviesSpan.dataset.to = stats.total_movies;
    moviesSpan.textContent = stats.total_movies;
  }

  // Update tier title and text
  const tierTitle = document.querySelector(".tier-title");
  const tierText = document.querySelector(".tier-text");
  if (tierTitle && tierText) {
    // Generate tier based on total_movies
    let title, text;
    if (stats.total_movies >= 50) {
      title = "PROFESSIONAL MOVIE WATCHER";
      text = "A list worthy of a museum.";
    } else if (stats.total_movies >= 40) {
      title = "MOVIE FANATIC!";
      text = "You got taste, and it SHOWS!";
    } else if (stats.total_movies >= 30) {
      title = "Movies are your thing";
      text = "And nothing is going to stop you.";
    } else if (stats.total_movies >= 20) {
      title = "Intense watcher!";
      text = "This is definitely worth bragging about.";
    } else if (stats.total_movies >= 10) {
      title = "Casually Watching";
      text = "And this is only the beginning of your journey.";
    } else if (stats.total_movies >= 5) {
      title = "Still so much... to explore!";
      text = "You're missing out on PEAK cinema. Get out there and explore!";
    } else {
      title = "Just getting started";
      text = "Every legend starts somewhere. Keep watching!";
    }
    tierTitle.textContent = title;
    tierText.textContent = text;
  }

  // Update genre chip
  const genreChip = document.querySelector(".genre-chip");
  if (genreChip) {
    genreChip.textContent = stats.most_common_genre || "Unknown";
  }
}
function setImdbRatingBars() {
  document.querySelectorAll(".rating-fill").forEach((bar) => {
    const rating = parseFloat(bar.dataset.rating);
    if (!Number.isFinite(rating)) return;

    const percent = Math.max(0, Math.min(100, rating * 10));
    bar.style.width = `${percent}%`;
  });
}

document.addEventListener("DOMContentLoaded", setImdbRatingBars);