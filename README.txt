MAN THRU SEARCH 429 FIX

This package contains the updated server.js only.
It keeps the existing frontend and subscription/admin functionality unchanged.

Change: when OpenStreetMap Nominatim returns HTTP 429, the server now tries a second query and the independent Photon free geocoder before returning a clear temporary-unavailable error. Overpass requests also have a timeout and the failure message is clearer.

To apply with GitHub Desktop:
1. Copy this server.js into your existing local `manthru` repository folder and choose Replace.
2. Open GitHub Desktop. It should show server.js under Changes.
3. Enter summary: Fix free geocoding fallback for business search
4. Click Commit to main, then Push origin.

Do not open index.html directly with file:// to test search; API searches need the hosted Node server. After pushing, wait for Render to finish deploying, then test https://manthru.onrender.com.
