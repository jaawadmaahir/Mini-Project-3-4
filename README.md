# WhereTo
**Don't know where to go? Discover somewhere new.**
Travel discovery web app for CSE-2340 Software Development I (MP3 & MP4). Search a destination, filter by category, view details and save favourite places.

## Features
Destination search (button + Enter) · category filters · responsive place cards · details modal (close with ✕, outside click, Esc) · favourites saved in Local Storage · Saved Places section · loading skeletons, error + retry, empty state · floating Facebook/Instagram buttons.

## Technologies
HTML5, CSS3, Vanilla JavaScript, OpenTripMap API, Local Storage. (No frameworks, no backend.)

## API
OpenTripMap — base `https://api.opentripmap.com/0.1/en/places`
1. `/geoname?name=` → destination coordinates
2. `/radius?radius&lon&lat&kinds&rate&limit&format=json` → nearby places
3. `/xid/{xid}` → details (image, Wikipedia description, address, links)

Categories map to `kinds`: natural, historic, architecture, museums, cultural, beaches, interesting_places.

## API key setup
1. Register at https://dev.opentripmap.com/ and get a free API key.
2. Open `config.js` and replace `YOUR_API_KEY_HERE` with your key.
3. Also replace `FACEBOOK_URL` and `INSTAGRAM_URL` with your own profile links.
If the key is missing/invalid the app shows an error message with a Retry button.

## How to run
Open `index.html` in a browser (or use VS Code Live Server). Internet is required.

## Folder structure
```
WhereTo/
├── index.html
├── style.css
├── script.js
├── config.js
├── README.md
└── assets/ (images/, icons/logo.svg)
```

## Local Storage
Key `whereto_favourites` stores an array of saved place objects as JSON. `loadFavourites()` reads it on page load, `saveFavourites()` writes it whenever a heart is toggled, so saved places stay after refresh.

## Assignment mapping
| Requirement | Implementation (script.js) |
|---|---|
| DOM Manipulation | `renderPlaces()`, `renderSaved()`, `renderCategories()`, `openModal()` |
| Event Handling | `addEventListener` for search submit, categories, hearts, details, modal close, Escape |
| Arrays & Objects | `places`, `favourites`, `CATEGORIES`, place objects from `buildPlace()` |
| Array Methods | `map` (cards), `filter` (named places, remove favourite), `forEach` (categories), `find` (modal), `some` |
| API Integration | OpenTripMap `geoname`, `radius`, `xid` |
| Fetch & Async/Await | `getJSON()`, `searchPlaces()` |
| Loading State | `showLoading()` skeleton cards |
| Error Handling | `showError()` + Retry; missing/invalid key, network, rate limit |
| Empty State | `showEmpty()` |
| Local Storage | `loadFavourites()`, `saveFavourites()` |

Developed by Mohammad Jawad Mahir
