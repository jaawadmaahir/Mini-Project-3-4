// =====================  WhereTo — script.js  =====================
// OpenTripMap docs: geoname -> radius -> xid (details)
const BASE_URL = "https://api.opentripmap.com/0.1/en/places";
const FAV_KEY = "whereto_favourites";
const MAX_PLACES = 12;

// Categories: label shown to user -> OpenTripMap "kinds" value
const CATEGORIES = [
  { label: "All Places", kinds: "interesting_places" },
  { label: "Nature", kinds: "natural" },
  { label: "Historic Places", kinds: "historic" },
  { label: "Architecture", kinds: "architecture" },
  { label: "Museums", kinds: "museums" },
  { label: "Cultural Places", kinds: "cultural" },
  { label: "Beaches", kinds: "beaches" },
  { label: "Interesting Places", kinds: "interesting_places" }
];
const SUGGESTIONS = ["Paris", "Cox's Bazar", "Tokyo", "London", "Rome", "Bali"];

// ---------- DOM selectors ----------
const $ = (id) => document.getElementById(id);
const searchForm = $("searchForm"), searchInput = $("searchInput");
const placesGrid = $("placesGrid"), savedGrid = $("savedGrid");
const loadingBox = $("loading"), errorBox = $("error"), emptyBox = $("empty");
const modal = $("modal"), modalBody = $("modalBody");

// ---------- App state ----------
let places = [];                 // places currently displayed
let currentDestination = "Paris";
let currentCategory = CATEGORIES[0];
let favourites = loadFavourites();

// ===================  LOCAL STORAGE  ===================
function loadFavourites() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; }
  catch (e) { return []; }
}
function saveFavourites() {
  localStorage.setItem(FAV_KEY, JSON.stringify(favourites));
}
function isFavourite(xid) {
  return favourites.some((p) => p.xid === xid);
}
function toggleFavourite(xid) {
  if (isFavourite(xid)) {
    favourites = favourites.filter((p) => p.xid !== xid);       // remove
  } else {
    const place = places.find((p) => p.xid === xid);            // add
    if (place) favourites.push(place);
  }
  saveFavourites();
  updateUI();
}

// ===================  API  ===================
// Small helper: fetch JSON and turn HTTP problems into readable errors
async function getJSON(url) {
  const res = await fetch(url);
  if (res.status === 401 || res.status === 403) throw new Error("Invalid or unauthorised API key. Check config.js.");
  if (res.status === 429) throw new Error("Too many requests. Please wait a moment and retry.");
  if (!res.ok) throw new Error("Server error (" + res.status + ").");
  return res.json();
}

// Step 1: destination name -> coordinates
async function getCoordinates(name) {
  const data = await getJSON(`${BASE_URL}/geoname?name=${encodeURIComponent(name)}&apikey=${OTM_API_KEY}`);
  if (data.status && data.status !== "OK") return null;   // destination not found
  return data;                                           // {name, country, lat, lon}
}

// Step 2: coordinates + category -> list of nearby places
async function getPlacesNear(lat, lon, kinds) {
  const url = `${BASE_URL}/radius?radius=10000&lon=${lon}&lat=${lat}&kinds=${kinds}&rate=2&limit=40&format=json&apikey=${OTM_API_KEY}`;
  return getJSON(url);
}

// Step 3: place id (xid) -> full details (image, description...)
async function getPlaceDetails(xid) {
  return getJSON(`${BASE_URL}/xid/${xid}?apikey=${OTM_API_KEY}`);
}

// Turn raw API data into one clean object
function buildPlace(basic, detail, geo) {
  const d = detail || {};
  const kinds = d.kinds || basic.kinds || "";
  const category = CATEGORIES.slice(1, 7).find((c) => kinds.includes(c.kinds));
  return {
    xid: basic.xid,
    name: d.name || basic.name,
    location: geo.name + ", " + geo.country,
    category: category ? category.label : "Interesting Places",
    description: (d.wikipedia_extracts && d.wikipedia_extracts.text) || "",
    image: (d.preview && d.preview.source) || d.image || "",
    address: d.address ? [d.address.road, d.address.city || d.address.town, d.address.country].filter(Boolean).join(", ") : "",
    rate: basic.rate,
    link: d.wikipedia || d.url || d.otm || "",
    wikiTitle: d.wikipedia && d.wikipedia.includes("/wiki/") ? decodeURIComponent(d.wikipedia.split("/wiki/")[1]) : ""
  };
}

// Many places have no photo in OpenTripMap, so we ask Wikipedia (free, no key) for one
async function addWikiImage(place) {
  if (place.image) return;
  try {
    const title = place.wikiTitle || place.name;
    const res = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title));
    if (!res.ok) return;
    const data = await res.json();
    if (data.type !== "standard") return;              // skip disambiguation / wrong pages
    if (data.thumbnail) place.image = data.thumbnail.source;
    if (!place.description && data.extract) place.description = data.extract;
  } catch (e) { /* no image available, placeholder will be shown */ }
}

// ===================  MAIN SEARCH FLOW  ===================
async function searchPlaces() {
  if (!OTM_API_KEY || OTM_API_KEY === "YOUR_API_KEY_HERE") {
    return showError("API key missing. Open config.js and add your OpenTripMap API key (see README).");
  }
  showLoading();
  try {
    const geo = await getCoordinates(currentDestination);
    if (!geo) return showEmpty();

    const list = await getPlacesNear(geo.lat, geo.lon, currentCategory.kinds);
    const named = list.filter((p) => p.name && p.name.trim() !== "").slice(0, MAX_PLACES);

    // Fetch details for every place at the same time
    const results = await Promise.allSettled(named.map((p) => getPlaceDetails(p.xid)));
    places = named.map((p, i) => buildPlace(p, results[i].status === "fulfilled" ? results[i].value : null, geo));

    await Promise.all(places.map(addWikiImage));
    $("resultInfo").textContent = `${places.length} places near ${geo.name} · ${currentCategory.label}`;
    if (places.length === 0) return showEmpty();
    hideStates();
    updateUI();
  } catch (err) {
    showError(err.message === "Failed to fetch" ? "Network problem. Check your internet connection." : err.message);
  }
}

// ===================  UI STATES  ===================
function hideStates() {
  [loadingBox, errorBox, emptyBox].forEach((el) => el.classList.add("hidden"));
}
function showLoading() {
  hideStates();
  placesGrid.innerHTML = "";
  loadingBox.innerHTML = "<div class='skeleton'></div>".repeat(6);
  loadingBox.classList.remove("hidden");
  $("resultInfo").textContent = "Finding places in " + currentDestination + "...";
}
function showError(message) {
  hideStates();
  placesGrid.innerHTML = "";
  $("errorMsg").textContent = message;
  errorBox.classList.remove("hidden");
}
function showEmpty() {
  hideStates();
  places = [];
  placesGrid.innerHTML = "";
  emptyBox.classList.remove("hidden");
}

// ===================  RENDERING  ===================
function cardHTML(p) {
  const short = p.description ? p.description.slice(0, 110).trim() + "…" : "Tap View Details to learn more.";
  return `
    <article class="card">
      <div class="card-img">
        <span class="ph">📍</span>
        ${p.image ? `<img src="${p.image}" alt="${p.name}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}
        <button class="heart ${isFavourite(p.xid) ? "on" : ""}" data-fav="${p.xid}" aria-label="Save place">♥</button>
      </div>
      <div class="card-body">
        <span class="tag">${p.category}</span>
        <h3>${p.name}</h3>
        <span class="loc">📍 ${p.location}</span>
        <p class="desc">${short}</p>
        <button class="btn btn-full" data-details="${p.xid}">View Details</button>
      </div>
    </article>`;
}
function renderPlaces() {
  placesGrid.innerHTML = places.map(cardHTML).join("");
}
function renderSaved() {
  savedGrid.innerHTML = favourites.map(cardHTML).join("");
  $("savedEmpty").classList.toggle("hidden", favourites.length > 0);
  $("savedBadge").textContent = favourites.length;
}
function updateUI() {
  renderPlaces();
  renderSaved();
}
function renderCategories() {
  const box = $("categories");
  box.innerHTML = "";
  CATEGORIES.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "pill" + (cat === currentCategory ? " active" : "");
    btn.textContent = cat.label;
    btn.addEventListener("click", () => {
      currentCategory = cat;
      renderCategories();
      searchPlaces();
    });
    box.appendChild(btn);
  });
}
function renderSuggestions() {
  SUGGESTIONS.forEach((city) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = city;
    btn.addEventListener("click", () => startSearch(city));
    $("suggestions").appendChild(btn);
  });
}

// ===================  MODAL  ===================
function openModal(xid) {
  const p = places.find((x) => x.xid === xid) || favourites.find((x) => x.xid === xid);
  if (!p) return;
  modalBody.innerHTML = `
    ${p.image ? `<img src="${p.image}" alt="${p.name}" onerror="this.outerHTML='<div class=modal-img-ph></div>'">` : "<div class='modal-img-ph'></div>"}
    <div class="modal-content">
      <span class="tag">${p.category}</span>
      <h2>${p.name}</h2>
      <p class="loc">📍 ${p.location}${p.address ? " · " + p.address : ""}</p>
      <p>${p.description || "No description is available for this place."}</p>
      <p><strong>Popularity rating:</strong> ${p.rate} / 7</p>
      ${p.link ? `<a class="btn" href="${p.link}" target="_blank" rel="noopener">More information ↗</a>` : ""}
    </div>`;
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeModal() {
  modal.classList.add("hidden");
  document.body.style.overflow = "";
}

// ===================  EVENTS  ===================
function startSearch(destination) {
  currentDestination = destination;
  searchInput.value = destination;
  currentCategory = CATEGORIES[0];
  renderCategories();
  searchPlaces();
  $("discover").scrollIntoView();
}
searchForm.addEventListener("submit", (e) => {         // click Search OR press Enter
  e.preventDefault();
  const value = searchInput.value.trim();
  if (value) startSearch(value);
});
// One listener for hearts + details buttons in both grids (event delegation)
[placesGrid, savedGrid].forEach((grid) => {
  grid.addEventListener("click", (e) => {
    const heart = e.target.closest("[data-fav]");
    const details = e.target.closest("[data-details]");
    if (heart) toggleFavourite(heart.dataset.fav);
    if (details) openModal(details.dataset.details);
  });
});
$("retryBtn").addEventListener("click", searchPlaces);
$("searchAgainBtn").addEventListener("click", () => { searchInput.focus(); $("home").scrollIntoView(); });
$("closeModal").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

// ===================  INIT  ===================
$("fbLink").href = FACEBOOK_URL;
$("igLink").href = INSTAGRAM_URL;
renderCategories();
renderSuggestions();
renderSaved();          // load saved places from Local Storage
searchInput.value = currentDestination;
searchPlaces();         // first load: show places for the default destination
