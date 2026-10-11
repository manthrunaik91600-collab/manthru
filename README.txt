Man Thru backend search fix

This server.js uses free public-web search (DuckDuckGo HTML/lite) for /api/leads/search and does not call OpenStreetMap/Nominatim/Overpass. It preserves the existing API routes in this supplied server.js source.

Install: replace the repository-root server.js only. Do not open this file in a browser. Commit and push the change so Render redeploys.

Important: free public search providers may block automated requests or return no matches. This removes the OSM rate-limit dependency; it cannot guarantee a specific number of leads.
