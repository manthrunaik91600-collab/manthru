// server.ts
import express from "express";
import path2 from "path";
import fs2 from "fs";
import { fileURLToPath } from "url";
import dotenv2 from "dotenv";

// src/server/leadService.ts
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
dotenv.config();
function getMapsApiKey() {
  return (process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();
}
function extractAreaFromAddress(address, fallbackArea) {
  if (fallbackArea && address.toLowerCase().includes(fallbackArea.toLowerCase())) {
    return fallbackArea.charAt(0).toUpperCase() + fallbackArea.slice(1);
  }
  if (!address) return fallbackArea || "Local Area";
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length >= 4) {
    for (let i = 1; i < parts.length - 2; i++) {
      const part = parts[i];
      if (!/^\d+[-/]?\d*$/.test(part) && part.length > 2 && !part.toLowerCase().includes("india")) {
        return part;
      }
    }
  }
  return fallbackArea || parts[1] || parts[0] || "Local Area";
}
function extractAreaFromQuery(query) {
  if (!query) return "";
  const clean = query.trim();
  const categoryWords = [
    "mobile",
    "mobiles",
    "cell",
    "phone",
    "phones",
    "chilli",
    "powder",
    "spices",
    "masala",
    "mirchi",
    "kirana",
    "grocery",
    "general",
    "shops",
    "shop",
    "stores",
    "store",
    "jewellers",
    "jewellery",
    "gold",
    "manufacturers",
    "manufacturer",
    "manufacturing",
    "interior",
    "designers",
    "pharmacies",
    "pharmacy",
    "medical",
    "sweets",
    "sweet",
    "dealers",
    "services",
    "companies",
    "wholesalers",
    "retailers",
    "firm",
    "agency",
    "contractors",
    "showroom",
    "showrooms",
    "dealership",
    "dealerships",
    "garages",
    "garage",
    "schools",
    "hospitals",
    "clinics",
    "gyms",
    "cafes",
    "restaurants",
    "hotels"
  ];
  const words = clean.split(/\s+/);
  const locationWords = [];
  for (const w of words) {
    if (categoryWords.includes(w.toLowerCase())) {
      break;
    }
    locationWords.push(w);
  }
  if (locationWords.length > 0) {
    return locationWords.join(" ");
  }
  return "";
}
function formatCategory(primaryTypeDisplay, primaryType, types) {
  if (primaryTypeDisplay) return primaryTypeDisplay;
  if (primaryType) {
    return primaryType.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
  if (types && types.length > 0) {
    const useful = types.find((t) => t !== "point_of_interest" && t !== "establishment");
    if (useful) {
      return useful.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
  }
  return "Business";
}
function categoryMatchGroup(categoryText) {
  const c = String(categoryText || "").toLowerCase().replace(/[_-]+/g, " ").trim();
  if (/\b(kirana|grocery|groceries|provision|general store|general stores|supermarket|convenience store|convenience|food store|minimarket)\b/.test(c)) return "grocery";
  if (/\b(gold|jewel|jewellery|jewelry|jeweler|jeweller|ornament)\b/.test(c)) return "jewellery";
  if (/\b(mobile|cell phone|smartphone|phone shop|mobile phone)\b/.test(c)) return "mobile";
  if (/\b(computer|laptop|it store|computer shop)\b/.test(c)) return "computer";
  if (/\b(pharmacy|pharmacies|chemist|medical shop|medical store|drug store)\b/.test(c)) return "pharmacy";
  if (/\b(restaurant|restaurants|cafe|cafes|coffee shop|fast food)\b/.test(c)) return "restaurant";
  if (/\b(salon|beauty parlour|beauty parlor|hairdresser)\b/.test(c)) return "salon";
  if (/\b(school|schools|college|colleges|university)\b/.test(c)) return "education";
  if (/\b(hospital|hospitals|clinic|clinics|doctor)\b/.test(c)) return "healthcare";
  if (/\b(hardware|building materials|paint shop|electrical shop)\b/.test(c)) return "hardware";
  return "";
}

function matchesRequestedCategory(name, categoryText, typeValues = []) {
  const group = categoryMatchGroup(categoryText);
  // Broad generic searches remain broad; recognized categories use positive semantic matching.
  if (!group) return true;
  const haystack = [name, ...(Array.isArray(typeValues) ? typeValues : [typeValues])]
    .filter(Boolean).join(" ").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const patterns = {
    grocery: /\b(kirana|grocery|groceries|supermarket|convenience store|convenience|general store|provision store|provision shop|food store|grocery store|minimarket|mini market)\b/,
    jewellery: /\b(gold|jewel|jewellery|jewelry|jeweller|jeweler|ornament)\b/,
    mobile: /\b(mobile phone|mobile|cell phone|smartphone|telecom shop|mobile phone store)\b/,
    computer: /\b(computer|laptop|it store|computer store|computer shop)\b/,
    pharmacy: /\b(pharmacy|pharmacies|chemist|medical store|medical shop|drug store|drugstore)\b/,
    restaurant: /\b(restaurant|cafe|coffee shop|fast food|food court)\b/,
    salon: /\b(salon|beauty parlour|beauty parlor|hairdresser|barber)\b/,
    education: /\b(school|college|university|educational institution)\b/,
    healthcare: /\b(hospital|clinic|doctor|medical centre|medical center)\b/,
    hardware: /\b(hardware|building material|paint shop|electrical shop)\b/
  };
  // Google Places often returns canonical type IDs such as grocery_store / food_store.
  const typeText = (Array.isArray(typeValues) ? typeValues : [typeValues]).filter(Boolean)
    .join(" ").toLowerCase().replace(/[_-]+/g, " ");
  const typePatterns = {
    grocery: /\b(grocery store|food store|supermarket|convenience store|general store|provision store)\b/,
    jewellery: /\b(jewelry store|jewellery store)\b/,
    mobile: /\b(cell phone store|mobile phone store)\b/,
    computer: /\b(computer store|electronics store)\b/,
    pharmacy: /\b(pharmacy|drugstore)\b/,
    restaurant: /\b(restaurant|cafe|fast food restaurant)\b/,
    salon: /\b(beauty salon|hair salon|hairdresser)\b/,
    education: /\b(school|college|university)\b/,
    healthcare: /\b(hospital|medical clinic|doctor)\b/,
    hardware: /\b(hardware store)\b/
  };
  return !!((patterns[group] && patterns[group].test(haystack)) || (typePatterns[group] && typePatterns[group].test(typeText)));
}

function isValidIndianMobile(phone) {
  if (!phone || /^not listed/i.test(String(phone))) return false;
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits);
}

async function searchOpenStreetMap(query, pageSize = 20, options = {}) {
  const targetArea = (options.targetArea || extractAreaFromQuery(query) || "").trim();
  const category = (options.targetCategory || query).trim();
  if (!targetArea) {
    const e = new Error("Enter a target area/locality so the public business directory can search nearby listings.");
    e.status = 400; e.code = "AREA_REQUIRED"; throw e;
  }
  // Use multiple free geocoders. Nominatim has a strict public rate limit and
  // may return HTTP 429; that must not immediately break business discovery.
  let lat = NaN, lon = NaN, geocodeErrors = [];
  const geocodeQueries = [targetArea + ", Telangana, India", targetArea + ", India"];
  for (const geocodeQuery of geocodeQueries) {
    try {
      const geocodeUrl = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + encodeURIComponent(geocodeQuery);
      const geoRes = await fetch(geocodeUrl, {
        headers: { "User-Agent": "ManThruBusinessDiscovery/1.2 (public business discovery; contact: support@manthru.in)", "Accept": "application/json" },
        signal: AbortSignal.timeout(8000)
      });
      if (!geoRes.ok) { geocodeErrors.push("Nominatim HTTP " + geoRes.status); }
      else {
        const geo = await geoRes.json();
        if (Array.isArray(geo) && geo.length && Number.isFinite(Number(geo[0].lat)) && Number.isFinite(Number(geo[0].lon))) {
          lat = Number(geo[0].lat); lon = Number(geo[0].lon); break;
        }
      }
    } catch (e) { geocodeErrors.push("Nominatim: " + (e.message || "request failed")); }
  }
  // Photon is an independent free geocoder fallback for Nominatim throttling.
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    try {
      const photonUrl = "https://photon.komoot.io/api/?limit=1&q=" + encodeURIComponent(targetArea + ", Telangana, India");
      const photonRes = await fetch(photonUrl, { headers: { "Accept": "application/json", "User-Agent": "ManThruBusinessDiscovery/1.2" }, signal: AbortSignal.timeout(8000) });
      if (!photonRes.ok) geocodeErrors.push("Photon HTTP " + photonRes.status);
      else {
        const photon = await photonRes.json();
        const coords = photon && photon.features && photon.features[0] && photon.features[0].geometry && photon.features[0].geometry.coordinates;
        if (Array.isArray(coords) && coords.length >= 2 && Number.isFinite(Number(coords[0])) && Number.isFinite(Number(coords[1]))) {
          lon = Number(coords[0]); lat = Number(coords[1]);
        }
      }
    } catch (e) { geocodeErrors.push("Photon: " + (e.message || "request failed")); }
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    const e = new Error("Could not locate " + targetArea + " using the free geocoding services. They may be temporarily busy; please try again in a few minutes.");
    e.status = 503; e.code = "GEOCODING_TEMPORARILY_UNAVAILABLE"; e.details = geocodeErrors.join("; "); throw e;
  }
  const c = category.toLowerCase();
  const limit = Math.min(Math.max(Number(pageSize) || 20, 1), 100);
  // Try a focused category first, then broaden to nearby named shops and businesses.
  // Public OSM coverage is uneven; one empty category query must not end the search.
  let specific = '"shop"';
  if (/kirana|grocery|provision|general store|supermarket/.test(c)) specific = '"shop"~"convenience|supermarket|general|greengrocer|wholesale|food"';
  else if (/gold|jewel|ornament/.test(c)) specific = '"shop"~"jewelry|jewellery|gold"';
  else if (/mobile|phone|electronics/.test(c)) specific = '"shop"~"mobile_phone|electronics|computer"';
  else if (/medical|pharmacy|chemist/.test(c)) specific = '"shop"="chemist"';
  else if (/restaurant|hotel|cafe|food/.test(c)) specific = '"amenity"~"restaurant|cafe|fast_food"';
  else if (/salon|beauty|parlour|parlor/.test(c)) specific = '"shop"~"hairdresser|beauty"';
  else if (/school|college|education/.test(c)) specific = '"amenity"~"school|college|university"';
  else if (/hospital|clinic|doctor/.test(c)) specific = '"amenity"~"hospital|clinic|doctors"';
  const stages = [
    { radius: 7000, filter: specific },
    { radius: 15000, filter: specific },
    { radius: 10000, filter: '"shop"' },
    { radius: 15000, filter: '"amenity"~"marketplace|restaurant|cafe|fast_food|pharmacy|bank|fuel|school|clinic|hospital"' }
  ];
  const endpoints = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
  let elements = [], lastError = null, usedFallback = false;
  const seenElements = new Set();
  for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
    const stage = stages[stageIndex];
    const overpassQuery = '[out:json][timeout:25];(nwr(around:' + stage.radius + ',' + lat + ',' + lon + ')[' + stage.filter + '];);out center tags ' + limit + ';';
    let data = null;
    for (const endpoint of endpoints) {
      try {
        const r = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "User-Agent": "ManThruBusinessDiscovery/1.1 (public business listings)" },
          body: "data=" + encodeURIComponent(overpassQuery),
          signal: AbortSignal.timeout(30000)
        });
        if (!r.ok) { lastError = new Error("OpenStreetMap query failed (HTTP " + r.status + ")"); continue; }
        data = await r.json();
        break;
      } catch (e) { lastError = e; }
    }
    if (!data) continue;
    const batch = Array.isArray(data.elements) ? data.elements : [];
    for (const el of batch) {
      const key = el.type + '_' + el.id;
      if (!seenElements.has(key)) { seenElements.add(key); elements.push(el); }
    }
    // Do not stop merely because Overpass returned raw elements: many are unnamed
    // map objects and get discarded below. Continue broader stages until enough
    // usable, named results (respecting the phone filter when enabled) are found.
    const usableCount = elements.filter((el) => {
      const tags = el.tags || {};
      const name = tags.name || tags["name:en"];
      if (!name) return false;
      if (options.onlyWithMobile) {
        return !!(tags.phone || tags["contact:phone"] || tags["contact:mobile"]);
      }
      return true;
    }).length;
    if (usableCount >= limit) break;
    if (stageIndex > 0 && usableCount > 0) usedFallback = true;
  }
  if (!elements.length && lastError) {
    const e = new Error("The free public business-map servers are busy right now (rate limit/temporary outage). Please retry after 1–2 minutes; no paid API key is required.");
    e.status = 502;
    throw e;
  }
  const seen = new Set(), leads = [];
  for (const el of elements) {
    const t = el.tags || {}, name = t.name || t["name:en"];
    if (!name) continue;
    const osmCategory = t.shop || t.amenity || t.office || t.craft || "";
    if (!matchesRequestedCategory(name, category, [osmCategory, t["shop:type"], t["cuisine"]])) continue;
    const address = [t["addr:housenumber"], t["addr:street"], t["addr:suburb"], t["addr:city"] || targetArea, t["addr:state"] || "Telangana"].filter(Boolean).join(", ");
    const key = (name + "|" + address).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const phone = t.phone || t["contact:phone"] || t["contact:mobile"] || "";
    if (options.onlyWithMobile && !phone) continue;
    const rawCategory = osmCategory || "Business";
    leads.push({ id: "osm_" + el.type + "_" + el.id, placeId: "", name, phone, category: String(rawCategory).replace(/_/g, " "), area: targetArea, address, website: t.website || t["contact:website"] || "", rating: null, reviews: 0, isVerified: false, source: "OpenStreetMap" });
    if (leads.length >= limit) break;
  }
  const message = leads.length
    ? `Found ${leads.length} public map listings${usedFallback ? ' using a broader nearby search' : ''}. Phone numbers are shown only when published in the source data.`
    : `No named public OpenStreetMap listings matched ${category} near ${targetArea}. Try turning off “Only With Mobile Numbers” or a broader nearby area; public map coverage may be limited.`;
  return { leads, searchQuery: query, targetArea, source: "OpenStreetMap public listings", attribution: "© OpenStreetMap contributors", totalFound: leads.length, message };
}

async function searchLegacyPlacesFallback(query, pageSize, options, apiKey) {
  // Secondary Google provider path for deployments where Places API (New) quota is exhausted
  // but the project's legacy Places Text Search endpoint remains enabled and available.
  const area = String(options?.targetArea || extractAreaFromQuery(query) || '').trim();
  const category = String(options?.targetCategory || query).trim();
  const q = area && !query.toLowerCase().includes(area.toLowerCase()) ? `${category} in ${area}` : query;
  const endpoint = 'https://maps.googleapis.com/maps/api/place/textsearch/json?query=' + encodeURIComponent(q) + '&region=in&key=' + encodeURIComponent(apiKey);
  const response = await fetch(endpoint, { headers: { 'Accept': 'application/json' } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !['OK', 'ZERO_RESULTS'].includes(payload.status)) {
    throw new Error(`Legacy Places fallback unavailable (${response.status || payload.status || 'unknown'}): ${payload.error_message || payload.status || 'request failed'}`);
  }
  const raw = Array.isArray(payload.results) ? payload.results : [];
  const cap = Math.min(Math.max(Number(pageSize) || 20, 1), 100);
  const places = [];
  for (const item of raw.slice(0, Math.min(cap, 20))) {
    let details = {};
    // Phone numbers are not returned by Text Search. Fetch public Place Details server-side.
    try {
      const dUrl = 'https://maps.googleapis.com/maps/api/place/details/json?place_id=' + encodeURIComponent(item.place_id) + '&fields=formatted_phone_number,international_phone_number,website,url,business_status,types,name,formatted_address&key=' + encodeURIComponent(apiKey);
      const dRes = await fetch(dUrl, { headers: { 'Accept': 'application/json' } });
      const dPayload = await dRes.json().catch(() => ({}));
      if (dRes.ok && dPayload.status === 'OK') details = dPayload.result || {};
    } catch (e) { /* keep text-search result; strict mobile filter below will discard missing phones */ }
    const rawPhone = details.international_phone_number || details.formatted_phone_number || '';
    places.push({
      id: item.place_id,
      displayName: { text: details.name || item.name || '' },
      formattedAddress: details.formatted_address || item.formatted_address || '',
      internationalPhoneNumber: rawPhone,
      nationalPhoneNumber: details.formatted_phone_number || rawPhone,
      websiteUri: details.website || '',
      googleMapsUri: details.url || '',
      primaryType: (details.types || item.types || [])[0] || '',
      types: details.types || item.types || [],
      businessStatus: details.business_status || 'OPERATIONAL'
    });
  }
  return places;
}

async function searchRealBusinesses(query, pageSize = 20, options) {
  if (!query || typeof query !== "string" || !query.trim()) {
    throw new Error("Search query is required.");
  }
  const cleanQuery = query.trim();
  pageSize = [20, 50, 100].includes(Number(pageSize)) ? Number(pageSize) : 20;
  const targetArea = (options?.targetArea || extractAreaFromQuery(cleanQuery) || "").trim();
  const strictFilter = options?.strictAreaFilter !== false;
  const onlyWithMobile = options?.onlyWithMobile === true;
  const apiKey = getMapsApiKey();
  if (!apiKey) {
    return await searchOpenStreetMap(cleanQuery, pageSize, options || {});
  }
  const url = "https://places.googleapis.com/v1/places:searchText";
  const fieldMask = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.nationalPhoneNumber",
    "places.internationalPhoneNumber",
    "places.websiteUri",
    "places.rating",
    "places.userRatingCount",
    "places.primaryTypeDisplayName",
    "places.primaryType",
    "places.types",
    "places.businessStatus",
    "places.googleMapsUri",
    "nextPageToken"
  ].join(",");
  let allRawPlaces = [];
  let pageToken = void 0;
  let pageCount = 0;
  const maxPages = pageSize >= 100 ? 5 : pageSize >= 50 ? 3 : 2;
  do {
    pageCount++;
    const reqBody = {
      textQuery: cleanQuery,
      pageSize: Math.min(pageSize, 20),
      languageCode: "en",
      regionCode: "IN"
    };
    if (pageToken) {
      reqBody.pageToken = pageToken;
    }
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-Maps-Solution-ID": "gmp_git_agentskills_v1",
          "X-Goog-FieldMask": fieldMask
        },
        body: JSON.stringify(reqBody)
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Places Search API error:", response.status, errorText);
        if (response.status === 401 || response.status === 403) {
          const err = new Error(
            "Google Places API key is unauthorized or invalid. Verify that Places API (New) is enabled for your project."
          );
          err.status = response.status;
          err.code = "AUTH_ERROR";
          throw err;
        }
        if (response.status === 429) {
          const err = new Error(
            "Google Places API quota exceeded. Please check quota and billing in Google Cloud Console."
          );
          err.status = 429;
          err.code = "QUOTA_EXCEEDED";
          throw err;
        }
        break;
      }
      const data = await response.json();
      const rawPlaces = data.places || [];
      allRawPlaces = [...allRawPlaces, ...rawPlaces];
      pageToken = data.nextPageToken;
      if (pageToken && pageCount < maxPages && allRawPlaces.length < pageSize) {
        await new Promise((r) => setTimeout(r, 1500));
      } else {
        break;
      }
    } catch (err) {
      if (err.code === "AUTH_ERROR" || err.code === "QUOTA_EXCEEDED") {
        console.warn("Places API (New) unavailable; trying legacy Google Places before OpenStreetMap:", err.code, err.message);
        try {
          const legacyPlaces = await searchLegacyPlacesFallback(cleanQuery, pageSize, options || {}, apiKey);
          if (legacyPlaces.length) {
            allRawPlaces = legacyPlaces;
            pageToken = undefined;
            break; // continue through the shared category, strict-area and mobile filters below
          }
        } catch (legacyError) {
          console.warn("Legacy Google Places fallback unavailable:", legacyError.message);
        }
        try {
          const fallback = await searchOpenStreetMap(cleanQuery, pageSize, options || {});
          fallback.source = "OpenStreetMap fallback (Google Places unavailable)";
          fallback.message = `${fallback.message || ""} Google Places was unavailable (${err.code}); results are from public OpenStreetMap listings.`.trim();
          return fallback;
        } catch (fallbackError) {
          console.error("OpenStreetMap fallback also failed:", fallbackError.message);
          fallbackError.status = fallbackError.status || 502;
          fallbackError.code = "ALL_SEARCH_PROVIDERS_FAILED";
          fallbackError.message = `Google Places failed (${err.code}) and all fallbacks failed: ${fallbackError.message}`;
          throw fallbackError;
        }
      }
      console.warn("Google Places page fetch warning:", err.message);
      break;
    }
  } while (pageToken && pageCount < maxPages && allRawPlaces.length < pageSize);
  // Google Text Search returns at most 20 places per page and up to 60 per query.
  // When the user asks for 50/100, run relevant category synonyms and paginate each
  // query so phone/area filtering does not leave the table short simply because only
  // the first page or one wording was searched. All results still come from Google.
  if (pageSize > 20) {
    const loc = targetArea || extractAreaFromQuery(cleanQuery) || "";
    let catClean = (options?.targetCategory || cleanQuery).trim();
    if (loc) {
      catClean = catClean.replace(new RegExp(`\\bin\\b\\s*${loc}`, "gi"), "").replace(new RegExp(loc, "gi"), "").trim();
    }
    if (!catClean) catClean = cleanQuery;
    const c = catClean.toLowerCase();
    let aliases = [];
    if (/kirana|grocery|provision|general store/.test(c)) aliases = ["kirana stores", "grocery stores", "Indian grocery stores", "provision shops", "provision stores", "general stores", "convenience stores", "supermarkets"];
    else if (/medical shop|medical store|pharmacy|chemist|drug store/.test(c)) aliases = ["pharmacies", "medical stores", "chemist shops"];
    else if (/gold shop|gold jewellery|jewellery|jeweler|jeweller/.test(c)) aliases = ["jewellery shops", "gold jewellery stores", "jewellers"];
    else if (/mobile shop|mobile phone|cell phone/.test(c)) aliases = ["mobile phone stores", "cell phone shops", "mobile dealers"];
    else if (/restaurant|hotel|cafe|food/.test(c)) aliases = ["restaurants", "cafes", "food outlets"];
    else if (/school|college|education/.test(c)) aliases = ["schools", "colleges", "educational institutions"];
    else if (/hardware/.test(c)) aliases = ["hardware stores", "building material shops", "tools stores"];
    else if (/salon|beauty parlour|beauty parlor/.test(c)) aliases = ["salons", "beauty parlours", "hair salons"];
    else aliases = [`${catClean} stores`, `${catClean} shops`, `${catClean} dealers`];

    const altQueries = [...new Set(aliases.map(alias => loc ? `${alias} in ${loc}` : alias))];
    const seenQueryIds = new Set(allRawPlaces.map(p => p.id).filter(Boolean));
    for (const altQ of altQueries) {
      let altToken;
      for (let altPage = 0; altPage < 3; altPage++) {
        try {
          const payload = { textQuery: altQ, pageSize: 20, languageCode: "en" };
          if (altToken) payload.pageToken = altToken;
          const altRes = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": apiKey,
              "X-Goog-Maps-Solution-ID": "gmp_git_agentskills_v1",
              "X-Goog-FieldMask": fieldMask
            },
            body: JSON.stringify(payload)
          });
          if (!altRes.ok) break;
          const altData = await altRes.json();
          for (const place of (altData.places || [])) {
            const key = place.id || `${(place.displayName?.text || "").toLowerCase()}_${(place.formattedAddress || "").toLowerCase()}`;
            if (!seenQueryIds.has(key)) {
              seenQueryIds.add(key);
              allRawPlaces.push(place);
            }
          }
          altToken = altData.nextPageToken;
          if (!altToken) break;
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (e) {
          console.warn("Google Places synonym search warning:", e.message);
          break;
        }
      }
    }
  }
  const seenPlaceKeys = /* @__PURE__ */ new Set();
  const uniquePlaces = [];
  for (const p of allRawPlaces) {
    const k = p.id || `${(p.displayName?.text || "").toLowerCase().trim()}_${(p.formattedAddress || "").toLowerCase().trim()}`;
    if (!seenPlaceKeys.has(k)) {
      seenPlaceKeys.add(k);
      uniquePlaces.push(p);
    }
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  let leads = uniquePlaces.map((place, idx) => {
    const name = place.displayName?.text || `Business ${idx + 1}`;
    const rawPhone = place.internationalPhoneNumber || place.nationalPhoneNumber || "";
    const phone = rawPhone ? rawPhone.trim() : "Not listed by Google Places";
    const address = place.formattedAddress || `${targetArea || "Local"}, India`;
    const area = extractAreaFromAddress(address, targetArea);
    const category = formatCategory(
      place.primaryTypeDisplayName?.text,
      place.primaryType,
      place.types
    );
    let website = place.websiteUri || "";
    if (!website && place.googleMapsUri) {
      website = place.googleMapsUri;
    }
    return {
      id: place.id || `lead_${Date.now()}_${idx}`,
      placeId: place.id,
      name,
      phone,
      category,
      area,
      address,
      website,
      rating: typeof place.rating === "number" ? place.rating : null,
      reviewCount: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
      operationalStatus: place.businessStatus === "OPERATIONAL" ? "Operational" : place.businessStatus || "Operational",
      googleMapsUri: place.googleMapsUri || "",
      source: "Google Places API",
      status: "New",
      notes: phone === "Not listed by Google Places" ? "Phone number not provided in public Google listing" : "",
      createdAt: now,
      searchQuery: cleanQuery
    };
  });
  const requestedCategory = (options?.targetCategory || cleanQuery).trim();
  const leadsBeforeCategoryFilter = leads.length;
  leads = leads.filter((lead, index) => {
    const place = uniquePlaces[index];
    const typeValues = [place?.primaryTypeDisplayName?.text, place?.primaryType, ...(place?.types || [])];
    return matchesRequestedCategory(lead.name, requestedCategory, [lead.category, ...typeValues]);
  });
  const categoryFilteredCount = leads.length;
  if (targetArea && targetArea.length >= 2 && strictFilter) {
    const lowerTarget = targetArea.toLowerCase();
    const strictlyFiltered = leads.filter((l) => {
      const addr = l.address.toLowerCase();
      const areaName = l.area.toLowerCase();
      return addr.includes(lowerTarget) || areaName.includes(lowerTarget);
    });
    // Strict Area Lock means exactly that: never fall back to unrelated areas.
    leads = strictlyFiltered;
  }
  if (onlyWithMobile) {
    leads = leads.filter((l) => {
      if (!l.phone || l.phone.startsWith("Not listed")) return false;
      return isValidIndianMobile(l.phone);
    });
  }
  leads = leads.slice(0, Math.min(Math.max(pageSize, 5), 100));
  let message = "";
  if (leads.length === 0) {
    if (leadsBeforeCategoryFilter > 0 && categoryFilteredCount === 0) {
      message = `Google Places returned listings, but none matched the requested category "${requestedCategory}". Unrelated businesses were filtered out. Try a more common category wording or nearby area.`;
    } else if (uniquePlaces.length > 0 && onlyWithMobile) {
      message = `Found ${uniquePlaces.length} matching businesses, but none listed a public phone number. Uncheck "Only With Mobile Numbers" to view all matching listings.`;
    } else {
      message = `No businesses found matching "${cleanQuery}" in category "${requestedCategory}". Try a broader area or alternate category wording.`;
    }
  } else {
    message = `Successfully discovered ${leads.length} genuine businesses via Google Places API.`;
  }
  if (leads.length === 0) {
    console.warn("Google Places produced zero matching leads; trying OpenStreetMap fallback.");
    try {
      const fallback = await searchOpenStreetMap(cleanQuery, pageSize, options || {});
      if (fallback.leads && fallback.leads.length > 0) {
        fallback.source = "OpenStreetMap fallback (no matching Google Places results)";
        fallback.message = `${fallback.message || ""} Google Places had no matching results; showing public OpenStreetMap listings.`.trim();
        return fallback;
      }
    } catch (fallbackError) {
      console.warn("OpenStreetMap zero-result fallback failed:", fallbackError.message);
    }
  }
  return {
    leads,
    searchQuery: cleanQuery,
    targetArea: targetArea || void 0,
    source: "Google Places API (New)",
    attribution: "Google Maps",
    totalFound: leads.length,
    requestedCount: pageSize,
    returnedCount: leads.length,
    message: leads.length < pageSize ? `${message} Requested up to ${pageSize}; ${leads.length} matched all selected filters. The source may not have more matching public listings.` : message
  };
}
async function generateSpecialDayMarketing(params) {
  const { date, businessName, businessType, phone, customInstructions, stylePreset } = params;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return getFallbackOccasion(date, businessName, businessType, phone, customInstructions);
  }
  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are a world-class creative marketing director, cinematic poster designer, and festival copywriter for Indian businesses.
Date: ${date}
Business Name: "${businessName}"
Business Type / Product: "${businessType}" (e.g. 100% Pure Red Chilli Powder & Spices wholesale, EV 2-Wheeler Showroom, etc.)
Contact Phone: "${phone}"
Style Preference: "${stylePreset || "Cinematic 3D Luxury Gold"}"
User Specific Revision Instructions: "${customInstructions || "Create an ultra-engaging, cinematic festival promotion"}"

Task:
1. Identify the special day, festival, or cultural significance of this date (or appropriate seasonal business celebration).
2. Follow the user's specific revision instructions carefully.
3. Write a high-converting, respectful, and lively festival greeting in Telugu and English that weaves in the business product with persuasive festive marketing appeal.
4. Craft a breathtaking, detailed DALL-E 3 / Midjourney cinematic image prompt that can be used directly in ChatGPT / DALL-E to generate a photorealistic 4K festival commercial poster with dramatic lighting.
5. Return strictly a JSON object inside \`\`\`json \`\`\` code fence:
{
  "occasion": "Name of the Special Day / Festival",
  "headline": "Punchy, cinematic 4-6 word headline",
  "greetingTextTelugu": "Warm festival wishes in Telugu weaving in product benefits (3-4 lines)",
  "greetingTextEnglish": "Warm wishes in English weaving in product offer (3-4 lines)",
  "offerHighlight": "Compelling festive discount or customer offer",
  "suggestedPosterColor": "Hex color code matching festival & theme (e.g. #dc2626 for chilli, #d97706 for gold festival, #059669 for eco EV)",
  "dallePrompt": "Ultra-detailed DALL-E 3 prompt for cinematic 4K commercial poster photography"
}`;
    const res = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt
    });
    const text = res.text || "";
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonStr = match ? match[1].trim() : text.trim();
    const data = JSON.parse(jsonStr);
    return {
      occasion: data.occasion || "Festival & Special Celebration Day",
      headline: data.headline || `${businessName} Festive Special`,
      greetingTextTelugu: data.greetingTextTelugu || `\u0C2E\u0C40\u0C15\u0C41 \u0C2E\u0C30\u0C3F\u0C2F\u0C41 \u0C2E\u0C40 \u0C15\u0C41\u0C1F\u0C41\u0C02\u0C2C \u0C38\u0C2D\u0C4D\u0C2F\u0C41\u0C32\u0C15\u0C41 \u0C36\u0C41\u0C2D\u0C3E\u0C15\u0C3E\u0C02\u0C15\u0C4D\u0C37\u0C32\u0C41!`,
      greetingTextEnglish: data.greetingTextEnglish || `Warm festive greetings from ${businessName}!`,
      offerHighlight: data.offerHighlight || "Special Festive Discounts Available Today!",
      suggestedPosterColor: data.suggestedPosterColor || "#dc2626",
      dallePrompt: data.dallePrompt || `Cinematic 4K festival poster celebrating ${data.occasion || "Festival"} for ${businessName}, vibrant traditional aesthetics, studio lighting, photorealistic, 8k resolution.`
    };
  } catch (err) {
    console.error("Gemini marketing generation fallback:", err);
    return getFallbackOccasion(date, businessName, businessType, phone, customInstructions);
  }
}
function getFallbackOccasion(date, businessName, businessType, phone, customInstructions) {
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  let occasion = "Special Celebration Day";
  let color = "#dc2626";
  if (month === 10 && day === 2) {
    occasion = "Gandhi Jayanti Special";
    color = "#15803d";
  } else if (month === 10 && day >= 10 && day <= 24) {
    occasion = "Dussehra & Vijayadashami Special";
    color = "#d97706";
  } else if (month === 11 && day <= 15) {
    occasion = "Diwali & Deepavali Festive Special";
    color = "#ea580c";
  } else if (month === 1 && day >= 13 && day <= 16) {
    occasion = "Sankranti & Pongal Celebration";
    color = "#ca8a04";
  } else if (month === 3 || month === 4) {
    occasion = "Ugadi & New Year Special";
    color = "#059669";
  } else {
    occasion = "Daily Customer Special & Fresh Deals";
    color = "#dc2626";
  }
  const isChilli = businessType.toLowerCase().includes("chilli") || businessType.toLowerCase().includes("spice");
  return {
    occasion,
    headline: `${businessName} - ${occasion}`,
    greetingTextTelugu: isChilli ? `\u0C2E\u0C40\u0C15\u0C41 \u0C2E\u0C30\u0C3F\u0C2F\u0C41 \u0C2E\u0C40 \u0C15\u0C41\u0C1F\u0C41\u0C02\u0C2C\u0C3E\u0C28\u0C3F\u0C15\u0C3F ${occasion} \u0C39\u0C3E\u0C30\u0C4D\u0C27\u0C3F\u0C15 \u0C36\u0C41\u0C2D\u0C3E\u0C15\u0C3E\u0C02\u0C15\u0C4D\u0C37\u0C32\u0C41! \u{1F64F}
\u0C2E\u0C3E ${businessName} \u0C28\u0C41\u0C02\u0C21\u0C3F 100% \u0C2A\u0C4D\u0C2F\u0C42\u0C30\u0C4D, \u0C28\u0C47\u0C1A\u0C41\u0C30\u0C32\u0C4D \u0C30\u0C46\u0C21\u0C4D \u0C1A\u0C3F\u0C32\u0C4D\u0C32\u0C40 \u0C2A\u0C4C\u0C21\u0C30\u0C4D & \u0C28\u0C3E\u0C23\u0C4D\u0C2F\u0C2E\u0C48\u0C28 \u0C38\u0C4D\u0C2A\u0C48\u0C38\u0C46\u0C38\u0C4D \u0C2A\u0C48 \u0C2A\u0C4D\u0C30\u0C24\u0C4D\u0C2F\u0C47\u0C15 \u0C2A\u0C02\u0C21\u0C41\u0C17 \u0C06\u0C2B\u0C30\u0C4D\u0C32\u0C41 \u0C05\u0C02\u0C26\u0C41\u0C2C\u0C3E\u0C1F\u0C41\u0C32\u0C4B \u0C09\u0C28\u0C4D\u0C28\u0C3E\u0C2F\u0C3F. \u0C38\u0C4D\u0C35\u0C1A\u0C4D\u0C1B\u0C2E\u0C48\u0C28 \u0C15\u0C3E\u0C30\u0C02 \u0C24\u0C4B \u0C2E\u0C40 \u0C35\u0C02\u0C1F\u0C32\u0C28\u0C41 \u0C2E\u0C30\u0C3F\u0C02\u0C24 \u0C30\u0C41\u0C1A\u0C3F\u0C15\u0C30\u0C02\u0C17\u0C3E \u0C1A\u0C47\u0C38\u0C41\u0C15\u0C4B\u0C02\u0C21\u0C3F!
\u0C06\u0C30\u0C4D\u0C21\u0C30\u0C4D\u0C38\u0C4D \u0C15\u0C4B\u0C38\u0C02: ${phone}.` : `\u0C2E\u0C40\u0C15\u0C41 \u0C2E\u0C30\u0C3F\u0C2F\u0C41 \u0C2E\u0C40 \u0C15\u0C41\u0C1F\u0C41\u0C02\u0C2C\u0C3E\u0C28\u0C3F\u0C15\u0C3F ${occasion} \u0C39\u0C3E\u0C30\u0C4D\u0C27\u0C3F\u0C15 \u0C36\u0C41\u0C2D\u0C3E\u0C15\u0C3E\u0C02\u0C15\u0C4D\u0C37\u0C32\u0C41! \u{1F64F}
\u0C2E\u0C3E ${businessName} \u0C28\u0C41\u0C02\u0C21\u0C3F \u0C2E\u0C40 \u0C35\u0C4D\u0C2F\u0C3E\u0C2A\u0C3E\u0C30\u0C3E\u0C28\u0C3F\u0C15\u0C3F \u0C38\u0C30\u0C3F\u0C15\u0C4A\u0C24\u0C4D\u0C24 \u0C06\u0C2B\u0C30\u0C4D\u0C32\u0C41 & \u0C2C\u0C46\u0C38\u0C4D\u0C1F\u0C4D \u0C2A\u0C4D\u0C30\u0C48\u0C38\u0C3F\u0C02\u0C17\u0C4D \u0C05\u0C02\u0C26\u0C3F\u0C38\u0C4D\u0C24\u0C41\u0C28\u0C4D\u0C28\u0C3E\u0C2E\u0C41.
\u0C2E\u0C30\u0C3F\u0C28\u0C4D\u0C28\u0C3F \u0C35\u0C3F\u0C35\u0C30\u0C3E\u0C32\u0C15\u0C41 \u0C38\u0C02\u0C2A\u0C4D\u0C30\u0C26\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F: ${phone}.`,
    greetingTextEnglish: isChilli ? `Warm wishes on this ${occasion}! \u{1F336}\uFE0F\u2728
Celebrate with 100% pure, natural, vibrant red chilli powder from ${businessName}. Unmatched flavor, rich color, and pure quality for your culinary delights.
Special bulk discounts available today! Contact: ${phone}.` : `Warm wishes on this ${occasion} from ${businessName}! \u2728
Avail exclusive discounts and special business offers today. Contact us at ${phone}.`,
    offerHighlight: customInstructions ? `Special Offer: ${customInstructions}` : "Special Festive Discount - 100% Quality Guaranteed!",
    suggestedPosterColor: color,
    dallePrompt: `Ultra-photorealistic cinematic 4k commercial poster for ${occasion} celebrating ${businessName}, ${businessType}. Dramatic volumetric golden hour lighting, rich textures, festive decorative background, hyper-detailed 8k resolution.`
  };
}

// src/server/userManager.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";
var DATA_DIR = path.resolve(process.cwd(), ".user_data");
var USERS_FILE = path.join(DATA_DIR, "subscribers.json");
var SETTINGS_FILE = path.join(DATA_DIR, "admin_settings.json");
var AUDIT_FILE = path.join(DATA_DIR, "admin_audit.json");
var OTP_STORE = /* @__PURE__ */ new Map();
var PIN_SALT = process.env.PIN_SALT || "man_thru_secure_salt_2026";
function hashPin(pin) {
  return crypto.createHash("sha256").update(`${pin.trim()}:${PIN_SALT}`).digest("hex");
}
function verifyPin(storedHashOrPlain, enteredPin) {
  if (!storedHashOrPlain || !enteredPin) return false;
  const cleanEntered = enteredPin.trim();
  if (storedHashOrPlain === hashPin(cleanEntered)) return true;
  if (storedHashOrPlain === cleanEntered) return true;
  return false;
}
var DEFAULT_SETTINGS = {
  ownerWhatsApp: "919160086793",
  upiId: "manthrunaik91600@okaxis",
  upiName: "Manthru Naik",
  monthlyPrice: 499,
  qrImageUrl: ""
};
function logAdminAction(action, targetMobile, details, ip) {
  ensureStorage();
  try {
    let logs = [];
    if (fs.existsSync(AUDIT_FILE)) {
      const raw = fs.readFileSync(AUDIT_FILE, "utf-8");
      logs = JSON.parse(raw || "[]");
    }
    logs.unshift({
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      action,
      targetMobile,
      details,
      adminIp: ip || "internal"
    });
    if (logs.length > 500) logs = logs.slice(0, 500);
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(logs, null, 2), "utf-8");
  } catch (e) {
    console.warn("Failed to log admin action:", e);
  }
}
function getAdminAuditLogs() {
  ensureStorage();
  try {
    if (fs.existsSync(AUDIT_FILE)) {
      const raw = fs.readFileSync(AUDIT_FILE, "utf-8");
      return JSON.parse(raw || "[]");
    }
  } catch (e) {
  }
  return [];
}
function getAdminSettings() {
  ensureStorage();
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw || "{}") };
    }
  } catch (e) {
  }
  return DEFAULT_SETTINGS;
}
function updateAdminSettings(settings, ip) {
  ensureStorage();
  const current = getAdminSettings();
  const updated = { ...current, ...settings };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), "utf-8");
  logAdminAction("UPDATE_SETTINGS", void 0, `Updated admin settings: ${Object.keys(settings).join(", ")}`, ip);
  return updated;
}
function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE)) {
    const initialUsers = {
      "9160086793": {
        mobile: "9160086793",
        name: "Manthru Naik (Owner)",
        category: "Owner Super Admin",
        pin: hashPin("2580"),
        status: "active",
        registeredAt: (/* @__PURE__ */ new Date()).toISOString(),
        activatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        expiresAt: "2099-12-31T23:59:59.000Z",
        notes: "Master Administrator",
        leads: []
      },
    };
    fs.writeFileSync(USERS_FILE, JSON.stringify(initialUsers, null, 2), "utf-8");
  }
}
function loadUsers() {
  ensureStorage();
  try {
    const raw = fs.readFileSync(USERS_FILE, "utf-8");
    const users = JSON.parse(raw || "{}");
    if (!users["9160086793"]) {
      users["9160086793"] = {
        mobile: "9160086793",
        name: "Manthru Naik (Owner)",
        category: "Owner Super Admin",
        pin: hashPin("2580"),
        status: "active",
        registeredAt: (/* @__PURE__ */ new Date()).toISOString(),
        activatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        expiresAt: "2099-12-31T23:59:59.000Z",
        notes: "Master Administrator",
        leads: []
      };
      saveUsers(users);
    }
    return users;
  } catch (e) {
    return {};
  }
}
function saveUsers(users) {
  ensureStorage();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}
function cleanMobile(phone) {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return digits.slice(-10);
}
function registerUser(mobile, name, category, pin) {
  const m = cleanMobile(mobile);
  if (m.length !== 10) return { success: false, message: "Please enter a valid 10-digit mobile number." };
  if (!name.trim()) return { success: false, message: "Please enter your business or full name." };
  if (pin.length < 4) return { success: false, message: "Please enter at least a 4-digit PIN / password." };
  const users = loadUsers();
  if (users[m]) {
    return { success: false, message: `Account already exists for +91 ${m}! Please switch to Login tab.` };
  }
  const isOwner = m === "9160086793";
  const newUser = {
    mobile: m,
    name: name.trim(),
    category: category.trim() || "General Business",
    pin: hashPin(pin),
    status: isOwner ? "active" : "inactive",
    // Locked until verified
    registeredAt: (/* @__PURE__ */ new Date()).toISOString(),
    expiresAt: isOwner ? "2099-12-31T23:59:59.000Z" : void 0,
    leads: []
  };
  users[m] = newUser;
  saveUsers(users);
  return {
    success: true,
    message: isOwner ? "Owner account registered successfully!" : "Account created successfully! Submit \u20B9499 payment proof (12-digit UTR) to activate 30-day Pro access.",
    user: sanitizeUser(newUser)
  };
}
function loginUser(mobile, pin) {
  const m = cleanMobile(mobile);
  const users = loadUsers();
  const user = users[m];
  if (!user) {
    return { success: false, message: `No account found for +91 ${m}. Please register first.` };
  }
  if (!verifyPin(user.pin, pin)) {
    return { success: false, message: 'Incorrect PIN / password. Use "Forgot PIN" to reset.' };
  }
  if (user.pin !== hashPin(pin)) {
    user.pin = hashPin(pin);
    saveUsers(users);
  }
  return { success: true, message: "Login successful!", user: getUserStatus(m) };
}
async function requestOtp(mobile, requireRegistered = false) {
  const m = cleanMobile(mobile);
  if (m.length !== 10) return { success: false, message: "Please enter a valid 10-digit mobile number." };
  const users = loadUsers();
  if (requireRegistered && !users[m] && m !== "9160086793" && m !== "9160000000") {
    return { success: false, message: `+91 ${m} is not registered yet. Please register first.` };
  }
  const otp = String(Math.floor(1e5 + Math.random() * 9e5));
  OTP_STORE.set(m, { otp, expiresAt: Date.now() + 5 * 60 * 1e3 });
  const fast2smsKey = process.env.FAST2SMS_API_KEY;
  if (fast2smsKey && !fast2smsKey.includes("YOUR_")) {
    try {
      await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          "authorization": fast2smsKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          route: "q",
          message: `MAN THRU: Your Security Verification OTP is ${otp}. Valid for 5 minutes. Do not share.`,
          language: "english",
          flash: 0,
          numbers: m
        })
      });
    } catch (e) {
      console.warn("SMS dispatch error:", e);
    }
  }
  return {
    success: true,
    message: `Security OTP sent for +91 ${m}. Valid for 5 minutes.`,
    demoOtp: process.env.NODE_ENV !== "production" || m === "9160086793" ? otp : void 0
  };
}
function verifyOtpAndLogin(mobile, otp) {
  const m = cleanMobile(mobile);
  const isOwner = m === "9160086793";
  if (isOwner && (otp.trim() === "2580" || otp.trim() === "9160")) {
    const users2 = loadUsers();
    let user2 = users2[m];
    if (!user2) {
      user2 = {
        mobile: m,
        name: "Manthru Naik (Owner)",
        category: "Owner Super Admin",
        pin: hashPin("2580"),
        status: "active",
        registeredAt: (/* @__PURE__ */ new Date()).toISOString(),
        activatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        expiresAt: "2099-12-31T23:59:59.000Z",
        leads: []
      };
      users2[m] = user2;
      saveUsers(users2);
    }
    return { success: true, message: "Owner Super Admin unlocked!", user: getUserStatus(m) };
  }
  const stored = OTP_STORE.get(m);
  if (!stored || stored.expiresAt < Date.now()) {
    return { success: false, message: "OTP expired or not found. Please request a new OTP." };
  }
  if (stored.otp !== otp.trim()) {
    return { success: false, message: "Invalid OTP code entered." };
  }
  OTP_STORE.delete(m);
  const users = loadUsers();
  let user = users[m];
  if (!user) {
    user = {
      mobile: m,
      name: `User ${m.slice(-4)}`,
      category: "General Business",
      pin: hashPin("1234"),
      status: "inactive",
      registeredAt: (/* @__PURE__ */ new Date()).toISOString(),
      leads: []
    };
    users[m] = user;
    saveUsers(users);
  }
  return { success: true, message: "OTP verified successfully!", user: getUserStatus(m) };
}
function resetPin(mobile, newPin) {
  const m = cleanMobile(mobile);
  if (newPin.length < 4) return { success: false, message: "PIN must be at least 4 digits." };
  const users = loadUsers();
  if (!users[m]) return { success: false, message: `Account +91 ${m} not found.` };
  users[m].pin = hashPin(newPin);
  saveUsers(users);
  return { success: true, message: "PIN updated successfully! You can now log in." };
}
function getUserStatus(mobile) {
  const m = cleanMobile(mobile);
  const users = loadUsers();
  const user = users[m];
  if (!user) return null;
  const isOwner = m === "9160086793";
  let daysLeft = 0;
  let isExpired = true;
  if (isOwner) {
    daysLeft = 36500;
    isExpired = false;
  } else if (user.expiresAt) {
    const diff = new Date(user.expiresAt).getTime() - Date.now();
    if (diff > 0) {
      daysLeft = Math.ceil(diff / (24 * 60 * 60 * 1e3));
      isExpired = false;
    }
  }
  if (!isOwner && isExpired && user.status === "active") {
    user.status = "inactive";
    saveUsers(users);
  }
  return {
    mobile: user.mobile,
    name: user.name,
    category: user.category,
    role: isOwner ? "owner" : "client",
    status: isOwner ? "active" : user.status,
    isSubscribed: isOwner || !isExpired && user.status === "active",
    daysLeft,
    expiresAt: isOwner ? "2099-12-31T23:59:59.000Z" : user.expiresAt || null,
    registeredAt: user.registeredAt,
    lastPaymentUtr: user.lastPaymentUtr || null,
    lastPaymentDate: user.lastPaymentDate || null,
    proofScreenshot: user.proofScreenshot || null,
    leadsCount: user.leads?.length || 0
  };
}
function submitPaymentProof(mobile, utr, screenshot) {
  const m = cleanMobile(mobile);
  const users = loadUsers();
  const user = users[m];
  if (!user) return { success: false, message: "Account not found. Please register first." };
  user.status = "pending";
  user.lastPaymentUtr = utr ? utr.trim() : "Manual WhatsApp/UPI Submission";
  user.lastPaymentDate = (/* @__PURE__ */ new Date()).toISOString();
  if (screenshot) {
    user.proofScreenshot = screenshot;
  }
  saveUsers(users);
  logAdminAction("PAYMENT_PROOF_SUBMITTED", m, `UTR: ${user.lastPaymentUtr}`);
  return {
    success: true,
    message: "Payment proof submitted! Your 30-day subscription will activate as soon as the Admin verifies the 12-digit UTR."
  };
}
function adminActivateUser(mobile, days = 30, ip) {
  const m = cleanMobile(mobile);
  const users = loadUsers();
  let user = users[m];
  if (!user) {
    const newExpiry = new Date(Date.now() + days * 24 * 60 * 60 * 1e3).toISOString();
    user = {
      mobile: m,
      name: `Client ${m.slice(-4)}`,
      pin: hashPin("1234"),
      status: "active",
      registeredAt: (/* @__PURE__ */ new Date()).toISOString(),
      activatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      expiresAt: newExpiry,
      leads: []
    };
    users[m] = user;
  } else {
    const currentExp = user.expiresAt ? new Date(user.expiresAt).getTime() : 0;
    const baseTime = currentExp > Date.now() ? currentExp : Date.now();
    const newExpiry = new Date(baseTime + days * 24 * 60 * 60 * 1e3).toISOString();
    user.status = "active";
    user.activatedAt = (/* @__PURE__ */ new Date()).toISOString();
    user.expiresAt = newExpiry;
  }
  saveUsers(users);
  logAdminAction("ACTIVATE_USER", m, `Activated for ${days} days until ${user.expiresAt.slice(0, 10)}`, ip);
  return {
    success: true,
    message: `\u2713 Account +91 ${m} activated for ${days} days! (Expiry: ${user.expiresAt.slice(0, 10)})`,
    user: getUserStatus(m)
  };
}
function adminDeactivateUser(mobile, ip) {
  const m = cleanMobile(mobile);
  if (m === "9160086793") {
    return { success: false, message: "Cannot deactivate master owner account." };
  }
  const users = loadUsers();
  const user = users[m];
  if (!user) return { success: false, message: "Account not found." };
  user.status = "inactive";
  user.expiresAt = (/* @__PURE__ */ new Date()).toISOString();
  saveUsers(users);
  logAdminAction("DEACTIVATE_USER", m, "Account deactivated and locked", ip);
  return { success: true, message: `\u2713 Account +91 ${m} deactivated.` };
}
function adminDeleteUser(mobile, ip) {
  const m = cleanMobile(mobile);
  if (m === "9160086793") {
    return { success: false, message: "Cannot delete master owner account." };
  }
  const users = loadUsers();
  if (!users[m]) return { success: false, message: "Account not found." };
  delete users[m];
  saveUsers(users);
  logAdminAction("DELETE_USER", m, "Account permanently removed by admin", ip);
  return { success: true, message: `\u2713 Account +91 ${m} permanently deleted.` };
}
function adminGetAllSubscribers() {
  const users = loadUsers();
  return Object.values(users).map((u) => getUserStatus(u.mobile));
}
function saveUserLeads(mobile, leads) {
  const m = cleanMobile(mobile);
  const users = loadUsers();
  if (!users[m]) return false;
  const existing = users[m].leads || [];
  const map = /* @__PURE__ */ new Map();
  for (const l of existing) {
    const k = l.placeId || l.id || `${(l.name || "").toLowerCase()}_${(l.address || "").toLowerCase()}`;
    map.set(k, l);
  }
  for (const l of leads) {
    const k = l.placeId || l.id || `${(l.name || "").toLowerCase()}_${(l.address || "").toLowerCase()}`;
    map.set(k, { ...map.get(k), ...l });
  }
  users[m].leads = Array.from(map.values());
  saveUsers(users);
  return true;
}
function addCustomLead(mobile, lead) {
  const m = cleanMobile(mobile);
  const users = loadUsers();
  if (!users[m]) return { success: false, message: "User not found" };
  if (!lead.name || !lead.name.trim()) {
    return { success: false, message: "Business name is required." };
  }
  const newLead = {
    id: lead.id || `custom_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
    name: lead.name.trim(),
    phone: lead.phone ? lead.phone.trim() : "Not listed",
    category: lead.category ? lead.category.trim() : "General",
    area: lead.area ? lead.area.trim() : "Local Area",
    address: lead.address ? lead.address.trim() : "",
    website: lead.website ? lead.website.trim() : "",
    status: lead.status || "New",
    priority: lead.priority || "Medium",
    orderValue: Number(lead.orderValue) || 5e3,
    source: "Manual",
    notes: lead.notes || "",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const leads = users[m].leads || [];
  const duplicate = leads.find((l) => newLead.phone && newLead.phone !== "Not listed" && l.phone === newLead.phone || l.name.toLowerCase() === newLead.name.toLowerCase() && l.area.toLowerCase() === newLead.area.toLowerCase());
  if (duplicate) {
    return { success: false, message: `Lead already exists (${duplicate.name})!` };
  }
  leads.unshift(newLead);
  users[m].leads = leads;
  saveUsers(users);
  return { success: true, lead: newLead, message: "Custom lead added successfully!" };
}
function deleteUserLeads(mobile, confirmPermanentDelete) {
  const m = cleanMobile(mobile);
  const users = loadUsers();
  if (!users[m]) return { success: false, message: "User not found" };
  if (!confirmPermanentDelete) {
    return { success: false, message: "Explicit confirmation required to permanently delete all server leads." };
  }
  const prevCount = users[m].leads?.length || 0;
  users[m].leads = [];
  saveUsers(users);
  return { success: true, message: `Permanently removed ${prevCount} leads from server storage.` };
}
function getUserLeads(mobile) {
  const m = cleanMobile(mobile);
  const users = loadUsers();
  return users[m]?.leads || [];
}
function sanitizeUser(u) {
  const { pin, ...safe } = u;
  return safe;
}

// server.ts
dotenv2.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var app = express();
var PORT = Number(process.env.PORT) || 3e3;
app.use(express.json());
app.use((req, res, next) => {
  // Never expose server-side environment or secret files over HTTP.
  if (/\/(?:\.env(?:\..*)?|package-lock\.json)$/i.test(req.path)) {
    res.status(404).end();
    return;
  }
  next();
});
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-pin, *");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Man Thru Universal Business Lead Tool",
    hasMapsApiKey: Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.post("/api/auth/register", (req, res) => {
  const { mobile, name, category, pin } = req.body;
  const result = registerUser(mobile, name, category, pin);
  res.json(result);
});
app.post("/api/auth/login", (req, res) => {
  const { mobile, pin } = req.body;
  const result = loginUser(mobile, pin);
  res.json(result);
});
app.post("/api/auth/request-otp", async (req, res) => {
  const { mobile, requireRegistered } = req.body;
  const result = await requestOtp(mobile, requireRegistered);
  res.json(result);
});
app.post("/api/auth/verify-otp", (req, res) => {
  const { mobile, otp } = req.body;
  const result = verifyOtpAndLogin(mobile, otp);
  res.json(result);
});
app.post("/api/auth/reset-pin", (req, res) => {
  const { mobile, newPin } = req.body;
  const result = resetPin(mobile, newPin);
  res.json(result);
});
app.get("/api/user/status", (req, res) => {
  const mobile = String(req.query.mobile || "");
  const status = getUserStatus(mobile);
  if (!status) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(status);
});
app.post("/api/user/leads", (req, res) => {
  const { mobile, leads } = req.body;
  if (!mobile || !Array.isArray(leads)) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }
  saveUserLeads(mobile, leads);
  res.json({ success: true, count: leads.length });
});
app.post("/api/user/leads/custom", (req, res) => {
  const { mobile, lead } = req.body;
  if (!mobile || !lead) {
    res.status(400).json({ error: "Mobile and lead details required" });
    return;
  }
  const result = addCustomLead(mobile, lead);
  res.json(result);
});
app.delete("/api/user/leads", (req, res) => {
  const { mobile, confirmPermanentDelete } = req.body;
  const result = deleteUserLeads(mobile, Boolean(confirmPermanentDelete));
  res.json(result);
});
app.get("/api/user/leads", (req, res) => {
  const mobile = String(req.query.mobile || "");
  const leads = getUserLeads(mobile);
  res.json({ leads });
});
app.get("/api/settings/public", (req, res) => {
  const s = getAdminSettings();
  res.json({
    ownerWhatsApp: s.ownerWhatsApp,
    upiId: s.upiId,
    upiName: s.upiName,
    monthlyPrice: s.monthlyPrice,
    qrImageUrl: s.qrImageUrl
  });
});
app.post("/api/payment/submit-proof", (req, res) => {
  const { mobile, utr, screenshot } = req.body;
  const result = submitPaymentProof(mobile, utr, screenshot);
  res.json(result);
});
app.post("/api/send-sms", async (req, res) => {
  const { mobile, otp, message, apiKey } = req.body;
  const cleanMob = String(mobile || "").replace(/\D/g, "").slice(-10);
  if (!cleanMob || cleanMob.length !== 10) {
    res.status(400).json({ success: false, reason: "INVALID_MOBILE" });
    return;
  }
  const fast2smsKey = apiKey || process.env.FAST2SMS_API_KEY;
  const smsText = message || `MAN THRU: Your Security Verification OTP is ${otp}. Valid for 5 minutes. Do not share.`;
  if (!fast2smsKey || fast2smsKey.includes("YOUR_")) {
    res.json({ success: true, message: "Simulated SMS OTP (Fast2SMS key not set)" });
    return;
  }
  try {
    const qRes = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        "authorization": fast2smsKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        route: "q",
        message: smsText,
        language: "english",
        flash: 0,
        numbers: cleanMob
      })
    });
    const qData = await qRes.json().catch(() => ({}));
    if (qData.return) {
      res.json({
        success: true,
        gatewayError: null,
        statusCode: 200,
        data: qData,
        message: `Real SMS successfully dispatched to +91 ${cleanMob}`
      });
      return;
    }
    res.json({
      success: false,
      gatewayError: qData.message || "Fast2SMS gateway error",
      statusCode: qData.status_code || 400,
      data: qData
    });
  } catch (err) {
    res.json({ success: false, gatewayError: err.message });
  }
});
function checkAdminAuth(pin) {
  return pin === "2580" || pin === "9160" || pin === process.env.ADMIN_MASTER_PIN;
}
app.get("/api/admin/settings", (req, res) => {
  const adminPin = String(req.query.adminPin || "");
  if (!checkAdminAuth(adminPin)) {
    res.status(403).json({ error: "Unauthorized: Invalid Admin PIN" });
    return;
  }
  res.json(getAdminSettings());
});
app.post("/api/admin/settings", (req, res) => {
  const { settings, adminPin } = req.body;
  if (!checkAdminAuth(adminPin)) {
    res.status(403).json({ error: "Unauthorized: Invalid Admin PIN" });
    return;
  }
  const updated = updateAdminSettings(settings || {}, req.ip);
  res.json(updated);
});
app.get("/api/admin/subscribers", (req, res) => {
  const adminPin = String(req.query.adminPin || "");
  if (!checkAdminAuth(adminPin)) {
    res.status(403).json({ error: "Unauthorized: Invalid Admin PIN" });
    return;
  }
  res.json({ subscribers: adminGetAllSubscribers() });
});
app.get("/api/admin/audit", (req, res) => {
  const adminPin = String(req.query.adminPin || "");
  if (!checkAdminAuth(adminPin)) {
    res.status(403).json({ error: "Unauthorized: Invalid Admin PIN" });
    return;
  }
  res.json({ audit: getAdminAuditLogs() });
});
app.post("/api/admin/activate", (req, res) => {
  const { mobile, days, adminPin } = req.body;
  if (!checkAdminAuth(adminPin)) {
    res.status(403).json({ error: "Unauthorized: Invalid Admin PIN" });
    return;
  }
  const result = adminActivateUser(mobile, Number(days) || 30, req.ip);
  res.json(result);
});
app.post("/api/admin/deactivate", (req, res) => {
  const { mobile, adminPin } = req.body;
  if (!checkAdminAuth(adminPin)) {
    res.status(403).json({ error: "Unauthorized: Invalid Admin PIN" });
    return;
  }
  const result = adminDeactivateUser(mobile, req.ip);
  res.json(result);
});
app.delete("/api/admin/user", (req, res) => {
  const mobile = req.body?.mobile || req.query.mobile;
  const adminPin = req.body?.adminPin || req.query.adminPin;
  if (!checkAdminAuth(adminPin)) {
    res.status(403).json({ error: "Unauthorized: Invalid Admin PIN" });
    return;
  }
  const result = adminDeleteUser(String(mobile), req.ip);
  res.json(result);
});
app.post("/api/marketing/special-day", async (req, res) => {
  try {
    const { date, businessName, businessType, phone, customInstructions, stylePreset } = req.body;
    const result = await generateSpecialDayMarketing({
      date: date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
      businessName: businessName || "My Business",
      businessType: businessType || "Red Chilli Powder & Spices Wholesale",
      phone: phone || "",
      customInstructions,
      stylePreset
    });
    res.json(result);
  } catch (err) {
    console.error("Marketing API error:", err);
    res.status(500).json({ error: err.message || "Failed to generate marketing post" });
  }
});
app.post("/api/leads/search", async (req, res) => {
  try {
    const { query, pageSize, targetArea, targetCategory, strictAreaFilter, onlyWithMobile } = req.body;
    if (!query || typeof query !== "string" || !query.trim()) {
      res.status(400).json({ error: "Search query is required" });
      return;
    }
    const result = await searchRealBusinesses(query, pageSize, {
      targetArea,
      targetCategory,
      strictAreaFilter,
      onlyWithMobile
    });
    res.json(result);
  } catch (error) {
    console.error("Lead search error:", error);
    const status = error.status || (error.code === "PROVIDER_NOT_CONFIGURED" ? 503 : 500);
    res.status(status).json({
      error: error.message || "Failed to search leads",
      code: error.code || "SEARCH_ERROR"
    });
  }
});
app.get("/api/download/html", (req, res) => {
  const filePath = fs2.existsSync(path2.join(__dirname, "public", "man_thru_business_lead_tool.html")) ? path2.join(__dirname, "public", "man_thru_business_lead_tool.html") : path2.join(__dirname, "index.html");
  res.download(filePath, "index.html");
});
app.get("/api/download/zip", (req, res) => {
  const zipPath = path2.join(__dirname, "public", "man_thru_lead_tool.zip");
  if (fs2.existsSync(zipPath)) {
    res.download(zipPath, "man_thru_lead_tool.zip");
  } else {
    res.status(404).json({ error: "Zip not found" });
  }
});
app.get("/api/download/godaddy-zip", (req, res) => {
  const zipPath = path2.join(__dirname, "public", "godaddy_cpanel_upload.zip");
  if (fs2.existsSync(zipPath)) {
    res.download(zipPath, "godaddy_cpanel_upload.zip");
  } else {
    res.status(404).json({ error: "GoDaddy zip not found" });
  }
});
app.use(express.static(path2.join(__dirname, "public")));
var distIndex = path2.join(__dirname, "dist", "index.html");
if (fs2.existsSync(distIndex)) {
  app.use(express.static(path2.join(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(distIndex);
  });
} else {
  app.use(express.static(__dirname));
  app.get("*", (req, res) => {
    res.sendFile(path2.join(__dirname, "index.html"));
  });
}
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Man Thru Lead Tool server running on http://0.0.0.0:${PORT}`);
});
