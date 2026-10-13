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
  if (/\b(bank|banks|bank branch|bank branches|atm)\b/.test(c)) return "bank";
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
    bank: /\b(bank|bank branch|atm)\b/,
    grocery: /\b(kirana|grocery|groceries|supermarket|convenience store|convenience|general store|general|provision store|provision shop|food store|grocery store|minimarket|mini market|greengrocer|wholesale)\b/,
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
  const typeText = (Array.isArray(typeValues) ? typeValues : [typeValues]).filter(Boolean)
    .join(" ").toLowerCase().replace(/[_-]+/g, " ");
  const typePatterns = {
    bank: /\b(bank|atm)\b/,
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
  // A known category must be supported by the business name or Places type/category;
  // never substitute the requested category when the provider returned no category.
  const nameText = String(name || "").toLowerCase().replace(/[_-]+/g, " ");
  if (group === "mobile") {
    const storeType = /\b(cell phone store|mobile phone store|mobile phone shop|mobile shop)\b/.test(typeText) ||
      /\b(cell phone store|mobile phone store|mobile phone shop|mobile shop)\b/.test(String(categoryText || "").toLowerCase());
    const looksLikeStore = /\b(mobiles?|mobile shop|mobile store|cell phone|smartphone shop)\b/.test(nameText);
    const serviceOnly = /\b(repair|service|servicing|technician)\b/.test(nameText) && !/\b(sales?|store|shop)\b/.test(nameText);
    return !serviceOnly && (storeType || looksLikeStore);
  }
  return !!((patterns[group] && patterns[group].test(haystack)) || (typePatterns[group] && typePatterns[group].test(typeText)));
}

function isValidIndianMobile(phone) {
  if (!phone || /^not listed/i.test(String(phone))) return false;
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits);
}

function decodeHtmlEntities(value = "") {
  return String(value).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
function stripHtml(value = "") {
  return decodeHtmlEntities(String(value).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}
function unescapeSearchUrl(href = "") {
  const raw = decodeHtmlEntities(href);
  try {
    const u = new URL(raw.startsWith("//") ? `https:${raw}` : raw, "https://html.duckduckgo.com");
    const redirected = u.searchParams.get("uddg");
    return redirected ? decodeURIComponent(redirected) : u.href;
  } catch { return ""; }
}
function pickPublicMobile(text = "") {
  const matches = String(text).match(/(?:\+?91[\s().-]*)?(?:0[\s().-]*)?[6-9](?:[\s().-]*\d){9}/g) || [];
  for (const candidate of matches) {
    const digits = candidate.replace(/\D/g, "");
    const ten = digits.length > 10 ? digits.slice(-10) : digits;
    if (/^[6-9]\d{9}$/.test(ten)) return ten;
  }
  return "";
}
function extractSearchResultBlocks(html, provider) {
  const blocks = [];
  const add = (href, titleHtml, snippetHtml, rawBlock = "") => {
    const sourceUrl = unescapeSearchUrl(href || "");
    if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) return;
    let host = "";
    try { host = new URL(sourceUrl).hostname.toLowerCase(); } catch { return; }
    if (/^(?:www\.)?(?:duckduckgo\.com|bing\.com|search\.yahoo\.com|google\.com|yandex\.com|mojeek\.com)$/i.test(host)) return;
    if (/facebook\.com|instagram\.com|youtube\.com|linkedin\.com|pinterest\.com|tiktok\.com/i.test(host)) return;
    const title = stripHtml(titleHtml || "").replace(/\s+[|–-]\s+[^|–-]{2,70}$/, "").trim();
    const snippet = stripHtml(snippetHtml || rawBlock || "").trim();
    if (title && title.length > 2 && !/^\s*(images|videos|news|maps|more results|feedback)\s*$/i.test(title)) {
      blocks.push({ sourceUrl, title, snippet, provider });
    }
  };
  if (provider === "bing") {
    for (const m of html.matchAll(/<li\b[^>]*class=["'][^"']*b_algo[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi)) {
      const block = m[1];
      const a = block.match(/<h2[^>]*>\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      if (!a) continue;
      const sm = block.match(/<(?:p|div)[^>]*class=["'][^"']*(?:b_caption|b_snippet)[^"']*["'][^>]*>([\s\S]*?)<\/(?:p|div)>/i);
      add(a[1], a[2], sm ? sm[1] : block, block);
    }
  }
  if (provider === "ddg") {
    for (const m of html.matchAll(/<a\b([^>]*class=["'][^"']*(?:result__a|result-link)[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi)) {
      const href = (m[1].match(/href=["']([^"']+)["']/i) || [])[1];
      if (!href) continue;
      const start = Math.max(0, html.lastIndexOf('<div class="result', m.index), html.lastIndexOf('<tr', m.index), m.index - 450);
      const after = m.index + m[0].length;
      const ends = [html.indexOf('<div class="result', after), html.indexOf('<tr', after)].filter(x => x >= 0);
      const end = ends.length ? Math.min(...ends) : Math.min(html.length, after + 1800);
      const block = html.slice(start, Math.max(after, end));
      const sm = block.match(/<(?:a|div|td)[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div|td)>/i);
      add(href, m[2], sm ? sm[1] : block, block);
    }
  }
  // Yahoo and other engines sometimes change wrapper classes; use outbound result links as a last parser fallback.
  if (!blocks.length) {
    for (const m of html.matchAll(/<a\b([^>]*href=["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi)) {
      const attrs = m[1] || "";
      if (/class=["'][^"']*(?:ac-algo|algo|result|web-result)[^"']*["']/i.test(attrs) || provider === "yahoo") {
        const after = m.index + m[0].length;
        const block = html.slice(Math.max(0, m.index - 350), Math.min(html.length, after + 900));
        add(m[2], m[3], block, block);
      }
    }
  }
  const seen = new Set();
  return blocks.filter(x => { if (seen.has(x.sourceUrl)) return false; seen.add(x.sourceUrl); return true; });
}

async function searchFreeWebBusinesses(query, pageSize = 20, options = {}) {
  const targetArea = String(options.targetArea || extractAreaFromQuery(query) || "").trim();
  const targetCategory = String(options.targetCategory || query).trim();
  const strictArea = options.strictAreaFilter !== false;
  const onlyWithMobile = options.onlyWithMobile === true;
  const clean = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const queries = [
    `"${targetArea}" "${targetCategory}" phone`,
    `${targetCategory} in ${targetArea} contact number`,
    `site:justdial.com ${targetArea} ${targetCategory}`,
    `site:indiamart.com ${targetArea} ${targetCategory}`,
    `"${targetArea}" "${targetCategory}" mobile number address`
  ].filter(Boolean);
  const providers = [
    { name: "ddg", url: q => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36", "Accept-Language": "en-IN,en;q=0.9", "Accept": "text/html,application/xhtml+xml" } },
    { name: "bing", url: q => `https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=en-IN`, headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36", "Accept-Language": "en-IN,en;q=0.9", "Accept": "text/html,application/xhtml+xml" } },
    { name: "yahoo", url: q => `https://search.yahoo.com/search?p=${encodeURIComponent(q)}`, headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36", "Accept-Language": "en-IN,en;q=0.9", "Accept": "text/html,application/xhtml+xml" } }
  ];
  const found = [];
  const seenUrls = new Set();
  const checkedProviders = new Set();
  for (const q of queries) {
    if (found.length >= pageSize) break;
    let queryHadResults = false;
    for (const provider of providers) {
      if (found.length >= pageSize) break;
      let html = "";
      try {
        const response = await fetch(provider.url(q), { headers: provider.headers, signal: AbortSignal.timeout(10000), redirect: "follow" });
        if (response.ok) {
          const candidate = await response.text();
          if (candidate.length > 1000) html = candidate;
          checkedProviders.add(provider.name);
        } else {
          console.warn(`Free ${provider.name} search returned HTTP ${response.status}`);
        }
      } catch (e) { console.warn(`Free ${provider.name} search endpoint failed:`, e.message); }
      if (!html) continue;
      const results = extractSearchResultBlocks(html, provider.name);
      if (results.length) queryHadResults = true;
      for (const result of results) {
        if (found.length >= pageSize) break;
        const sourceUrl = result.sourceUrl;
        if (seenUrls.has(sourceUrl)) continue;
        seenUrls.add(sourceUrl);
        const name = result.title;
        const snippet = result.snippet;
        if (!name || name.length < 3) continue;
        let pageText = `${name} ${snippet}`;
        let pageHtml = "";
        try {
          const pageRes = await fetch(sourceUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; ManThruPublicListingSearch/1.1)", "Accept-Language": "en-IN,en;q=0.9" }, signal: AbortSignal.timeout(6500), redirect: "follow" });
          if (pageRes.ok && /text\/html/i.test(pageRes.headers.get("content-type") || "text/html")) {
            pageHtml = (await pageRes.text()).slice(0, 900000);
            pageText += " " + stripHtml(pageHtml).slice(0, 35000);
          }
        } catch { /* Keep only details grounded in the public result snippet if the page blocks automated access. */ }
        const normalizedArea = clean(targetArea);
        const normalizedText = clean(pageText);
        const areaMentioned = !!normalizedArea && (` ${normalizedText} `).includes(` ${normalizedArea} `);
        if (strictArea && !areaMentioned) continue;
        if (!matchesRequestedCategory(name, targetCategory, [snippet, pageText])) continue;
        const mobile = pickPublicMobile(pageText);
        if (onlyWithMobile && !mobile) continue;
        let address = "";
        const jsonLd = [...pageHtml.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
        for (const raw of jsonLd) {
          try {
            const data = JSON.parse(raw);
            const nodes = Array.isArray(data) ? data : [data, ...(Array.isArray(data["@graph"]) ? data["@graph"] : [])];
            for (const node of nodes) {
              const addr = node.address;
              if (typeof addr === "string") address = addr;
              else if (addr && typeof addr === "object") address = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode].filter(Boolean).join(", ");
              if (address) break;
            }
          } catch { /* Ignore malformed JSON-LD. */ }
          if (address) break;
        }
        if (!address) {
          const meta = pageHtml.match(/<meta[^>]*(?:property|name)=["'](?:og:description|description)["'][^>]*content=["']([^"']+)["']/i);
          const desc = meta ? decodeHtmlEntities(meta[1]) : snippet;
          if (targetArea && clean(desc).includes(normalizedArea) && /\b(address|located|road|street|nagar|colony|market|main road|near|locality|\d{6})\b/i.test(desc)) address = desc.slice(0, 240);
        }
        // Keep the strict locality requirement; when the listing explicitly names the target area but omits a street address,
        // record the locality rather than inventing a street address.
        if (!address && areaMentioned) address = targetArea;
        if (!address || !sourceUrl || !/^https?:\/\//i.test(sourceUrl)) continue;
        found.push({
          id: `freeweb_${Date.now()}_${found.length}`, placeId: "", name,
          phone: mobile || "", category: targetCategory, area: targetArea,
          address, website: sourceUrl, rating: null, reviewCount: null,
          operationalStatus: "Public web listing found", googleMapsUri: "", sourceUrl,
          whatsappLink: mobile ? `https://wa.me/91${mobile}` : "", source: `Free ${provider.name.toUpperCase()} public web search`,
          status: "New", notes: "Public listing source attached; verify details before outreach.", createdAt: new Date().toISOString(), searchQuery: query
        });
      }
      // Once an engine has provided usable results for a query, do not hammer it or other engines unnecessarily.
      if (queryHadResults && found.length >= pageSize) break;
    }
  }
  const unique = [];
  const keys = new Set();
  for (const lead of found) {
    const key = `${clean(lead.name)}|${lead.phone}|${clean(lead.address)}`;
    if (keys.has(key)) continue;
    keys.add(key); unique.push(lead);
  }
  const count = Math.min(unique.length, pageSize);
  return {
    leads: unique.slice(0, pageSize), searchQuery: query, targetArea, targetCategory,
    source: "Free public-web search (DuckDuckGo, Bing, Yahoo)", attribution: "Public web source URL included per result",
    totalFound: count,
    message: count ? `Found ${count} public web listings. Phone numbers are included only when present in public result text or the linked page; verify before outreach.` : `No listings passed the public-source, category, and ${strictArea ? "strict area" : "area"} checks. Free search providers may block automated requests or return incomplete snippets. No sample or invented leads were added. Providers checked: ${[...checkedProviders].join(", ") || "none returned readable results"}.`,
    sourcesChecked: queries,
    providersChecked: [...checkedProviders]
  };
}

async function searchGooglePlacesBusinesses(query, pageSize = 20, options = {}) {
  const apiKey = String(process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || "").trim();
  if (!apiKey) return null;
  const targetArea = String(options.targetArea || extractAreaFromQuery(query) || "").trim();
  const targetCategory = String(options.targetCategory || query || "").trim();
  const strictArea = options.strictAreaFilter !== false;
  const onlyWithMobile = options.onlyWithMobile === true;
  const clean = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const textQuery = `${targetCategory} in ${targetArea}`.trim();
  const headers = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": apiKey,
    "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.primaryTypeDisplayName,places.primaryType,places.types,places.websiteUri,places.googleMapsUri,places.rating,places.userRatingCount,nextPageToken"
  };
  const leads = [];
  const seen = new Set();
  let pageToken = "";
  let pages = 0;
  try {
    while (leads.length < pageSize && pages < 3) {
      const body = { textQuery, pageSize: Math.min(20, Math.max(1, pageSize - leads.length)), languageCode: "en", regionCode: "IN" };
      if (pageToken) body.pageToken = pageToken;
      const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15000)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.error?.message || `Google Places API returned HTTP ${response.status}`;
        const err = new Error(message);
        err.status = response.status;
        err.code = "GOOGLE_PLACES_ERROR";
        throw err;
      }
      pages += 1;
      const places = Array.isArray(data.places) ? data.places : [];
      for (const place of places) {
        if (leads.length >= pageSize) break;
        const name = String(place.displayName?.text || "").trim();
        const address = String(place.formattedAddress || "").trim();
        const phone = pickPublicMobile(place.nationalPhoneNumber || place.internationalPhoneNumber || "");
        const category = String(place.primaryTypeDisplayName?.text || formatCategory("", place.primaryType, place.types) || "Business").trim();
        if (!name || !address) continue;
        if (strictArea && !clean(address).includes(clean(targetArea))) continue;
        if (!matchesRequestedCategory(name, targetCategory, [category, ...(place.types || [])])) continue;
        if (onlyWithMobile && !phone) continue;
        const key = `${clean(name)}|${phone}|${clean(address)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        leads.push({
          id: place.id || `google_places_${Date.now()}_${leads.length}`,
          placeId: place.id || "", name, phone: phone || "", category, area: targetArea,
          address, website: place.websiteUri || place.googleMapsUri || "", rating: place.rating ?? null,
          reviewCount: place.userRatingCount ?? null, operationalStatus: "Google Places public business listing",
          googleMapsUri: place.googleMapsUri || "", sourceUrl: place.googleMapsUri || place.websiteUri || "",
          whatsappLink: phone ? `https://wa.me/91${phone}` : "", source: "Google Places API",
          status: "New", notes: "Business listing retrieved from Google Places; verify details before outreach.",
          createdAt: new Date().toISOString(), searchQuery: query
        });
      }
      pageToken = data.nextPageToken || "";
      if (!pageToken || !places.length) break;
    }
    return {
      leads: leads.slice(0, pageSize), searchQuery: query, targetArea, targetCategory,
      source: "Google Places API", attribution: "Google Places business listing; Google Maps links included where available",
      totalFound: Math.min(leads.length, pageSize),
      message: leads.length
        ? `Found ${Math.min(leads.length, pageSize)} Google Places listings after applying ${strictArea ? "strict area" : "area"} and category checks${onlyWithMobile ? " and requiring a publicly listed mobile number" : "."}`
        : `Google Places returned no listings matching the selected area/category${onlyWithMobile ? " with a publicly listed mobile number" : ""}. No sample or invented leads were added.`,
      sourcesChecked: ["Google Places API"], providersChecked: ["Google Places API"]
    };
  } catch (error) {
    console.error("Google Places search failed:", error.message);
    throw error;
  }
}

async function searchRealBusinesses(query, pageSize = 20, options = {}) {
  if (!query || typeof query !== "string" || !query.trim()) throw new Error("Search query is required.");
  const cleanQuery = query.trim();
  pageSize = [20, 50, 100].includes(Number(pageSize)) ? Number(pageSize) : 20;
  const targetArea = String(options.targetArea || extractAreaFromQuery(cleanQuery) || "").trim();
  const targetCategory = String(options.targetCategory || cleanQuery).trim();
  if (!targetArea || !targetCategory) throw new Error("Target area and business category are both required.");
  // Quota-independent lead search: do not call Google Places, which can fail with HTTP 429.
  // Search public web listings using DuckDuckGo, Bing, and Yahoo; retain strict area/mobile filters.
  return await searchFreeWebBusinesses(cleanQuery, pageSize, { ...options, targetArea, targetCategory, strictAreaFilter: options.strictAreaFilter !== false });
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
    hasOpenAIKey: false,
    hasGooglePlacesKey: Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY),
    searchProvider: (process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY) ? "Google Places API" : "Free public-web search fallback",
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