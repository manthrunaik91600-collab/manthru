MAN THRU PUBLIC-WEB SEARCH FALLBACK PATCH

This patch updates server.js only. It preserves the existing routes and the rest of the server file.
It tries free public HTML search providers (DuckDuckGo, Bing, Yahoo) and parses results more robustly.
It does not invent business names or phone numbers; phone numbers are populated only when found in fetched public result text/pages. Free providers may still block automated requests or return no matching results.

Install: replace the existing repository server.js with this server.js, commit/push, then wait for Render deploy and test the live site.
