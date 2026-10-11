import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
dotenv.config();

export interface BusinessLead {
  id: string;
  name: string;
  phone: string;
  category: string;
  area: string;
  address: string;
  website: string;
  rating?: number | null;
  reviewCount?: number | null;
  operationalStatus?: string;
  description?: string;
  email?: string;
  googleMapsUri?: string;
  placeId?: string;
  source: 'Google Places API' | 'Google Search' | 'Manual';
  status: 'New' | 'Contacted' | 'Follow Up' | 'Qualified' | 'Converted' | 'Not Interested';
  notes?: string;
  lastContactedAt?: string;
  followUpDate?: string;
  followUpTime?: string;
  isCustomer?: boolean;
  customerSince?: string;
  dealValue?: string;
  createdAt: string;
  searchQuery: string;
}

export interface SearchOptions {
  targetArea?: string;
  targetCategory?: string;
  strictAreaFilter?: boolean;
  onlyWithMobile?: boolean;
}

export function getMapsApiKey(): string {
  return (
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    ''
  ).trim();
}

/**
 * Intelligent helper to extract area/neighborhood from formatted Indian/Global address.
 */
function extractAreaFromAddress(address: string, fallbackArea?: string): string {
  if (fallbackArea && address.toLowerCase().includes(fallbackArea.toLowerCase())) {
    return fallbackArea.charAt(0).toUpperCase() + fallbackArea.slice(1);
  }

  if (!address) return fallbackArea || 'Local Area';

  const parts = address.split(',').map((p) => p.trim());
  if (parts.length >= 4) {
    for (let i = 1; i < parts.length - 2; i++) {
      const part = parts[i];
      if (!/^\d+[-/]?\d*$/.test(part) && part.length > 2 && !part.toLowerCase().includes('india')) {
        return part;
      }
    }
  }

  return fallbackArea || parts[1] || parts[0] || 'Local Area';
}

function extractAreaFromQuery(query: string): string {
  if (!query) return '';
  const clean = query.trim();
  const categoryWords = [
    'mobile', 'mobiles', 'cell', 'phone', 'phones',
    'chilli', 'powder', 'spices', 'masala', 'mirchi',
    'kirana', 'grocery', 'general',
    'shops', 'shop', 'stores', 'store', 'jewellers', 'jewellery', 'gold',
    'manufacturers', 'manufacturer', 'manufacturing', 'interior', 'designers',
    'pharmacies', 'pharmacy', 'medical', 'sweets', 'sweet', 'dealers', 'services',
    'companies', 'wholesalers', 'retailers', 'firm', 'agency', 'contractors',
    'showroom', 'showrooms', 'dealership', 'dealerships', 'garages', 'garage',
    'schools', 'hospitals', 'clinics', 'gyms', 'cafes', 'restaurants', 'hotels',
  ];

  const words = clean.split(/\s+/);
  const locationWords: string[] = [];
  for (const w of words) {
    if (categoryWords.includes(w.toLowerCase())) {
      break;
    }
    locationWords.push(w);
  }

  if (locationWords.length > 0) {
    return locationWords.join(' ');
  }

  return '';
}

function formatCategory(primaryTypeDisplay?: string, primaryType?: string, types?: string[]): string {
  if (primaryTypeDisplay) return primaryTypeDisplay;
  if (primaryType) {
    return primaryType
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  if (types && types.length > 0) {
    const useful = types.find((t) => t !== 'point_of_interest' && t !== 'establishment');
    if (useful) {
      return useful
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
  }
  return 'Business';
}

export async function searchRealBusinesses(
  query: string,
  pageSize: number = 20,
  options?: SearchOptions
): Promise<{
  leads: BusinessLead[];
  searchQuery: string;
  targetArea?: string;
  source: string;
  attribution: string;
  totalFound: number;
  message?: string;
}> {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new Error('Search query is required.');
  }

  const cleanQuery = query.trim();
  const targetArea = (options?.targetArea || extractAreaFromQuery(cleanQuery) || '').trim();
  const strictFilter = options?.strictAreaFilter !== false;
  const onlyWithMobile = options?.onlyWithMobile !== false;

  const apiKey = getMapsApiKey();
  if (!apiKey) {
    const err: any = new Error(
      'Business search provider is not configured on the server. Please set GOOGLE_MAPS_API_KEY in server environment.'
    );
    err.status = 503;
    err.code = 'PROVIDER_NOT_CONFIGURED';
    throw err;
  }

  const url = 'https://places.googleapis.com/v1/places:searchText';
  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.nationalPhoneNumber',
    'places.internationalPhoneNumber',
    'places.websiteUri',
    'places.rating',
    'places.userRatingCount',
    'places.primaryTypeDisplayName',
    'places.primaryType',
    'places.types',
    'places.businessStatus',
    'places.googleMapsUri',
    'nextPageToken',
  ].join(',');

  let allRawPlaces: any[] = [];
  let pageToken: string | undefined = undefined;
  let pageCount = 0;
  const maxPages = 5;

  do {
    pageCount++;
    const reqBody: any = {
      textQuery: cleanQuery,
      pageSize: Math.min(pageSize, 20),
    };
    if (pageToken) {
      reqBody.pageToken = pageToken;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-Maps-Solution-ID': 'gmp_git_agentskills_v1',
          'X-Goog-FieldMask': fieldMask,
        },
        body: JSON.stringify(reqBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Places Search API error:', response.status, errorText);

        if (response.status === 401 || response.status === 403) {
          const err: any = new Error(
            'Google Places API key is unauthorized or invalid. Verify that Places API (New) is enabled for your project.'
          );
          err.status = response.status;
          err.code = 'AUTH_ERROR';
          throw err;
        }

        if (response.status === 429) {
          const err: any = new Error(
            'Google Places API quota exceeded. Please check quota and billing in Google Cloud Console.'
          );
          err.status = 429;
          err.code = 'QUOTA_EXCEEDED';
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
    } catch (err: any) {
      if (err.code === 'AUTH_ERROR' || err.code === 'QUOTA_EXCEEDED') {
        throw err;
      }
      console.warn('Google Places page fetch warning:', err.message);
      break;
    }
  } while (pageToken && pageCount < maxPages && allRawPlaces.length < pageSize);

  // If user requested 50 or 100 leads and single query returned fewer, try related search queries
  if (allRawPlaces.length < pageSize && pageSize > 20) {
    const loc = targetArea || extractAreaFromQuery(cleanQuery) || '';
    let catClean = (options?.targetCategory || cleanQuery).trim();
    if (loc) {
      catClean = catClean.replace(new RegExp(`\\bin\\b\\s*${loc}`, 'gi'), '').replace(new RegExp(loc, 'gi'), '').trim();
    }
    if (!catClean) catClean = cleanQuery;

    const altQueries = [
      loc ? `${catClean} stores in ${loc}` : `${catClean} stores`,
      loc ? `${catClean} wholesale in ${loc}` : `${catClean} wholesale`,
      loc ? `${catClean} dealers in ${loc}` : `${catClean} dealers`,
      loc ? `top ${catClean} in ${loc}` : `top ${catClean}`,
    ];

    for (const altQ of altQueries) {
      if (allRawPlaces.length >= pageSize) break;
      try {
        const altRes = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-Maps-Solution-ID': 'gmp_git_agentskills_v1',
            'X-Goog-FieldMask': fieldMask,
          },
          body: JSON.stringify({
            textQuery: altQ,
            pageSize: 20,
          }),
        });
        if (altRes.ok) {
          const altData = await altRes.json();
          if (altData.places && altData.places.length > 0) {
            allRawPlaces = [...allRawPlaces, ...altData.places];
          }
        }
      } catch (e) {
        // continue
      }
    }
  }

  // Deduplicate raw places by Google Place ID and name/address
  const seenPlaceKeys = new Set<string>();
  const uniquePlaces: any[] = [];
  for (const p of allRawPlaces) {
    const k = p.id || `${(p.displayName?.text || '').toLowerCase().trim()}_${(p.formattedAddress || '').toLowerCase().trim()}`;
    if (!seenPlaceKeys.has(k)) {
      seenPlaceKeys.add(k);
      uniquePlaces.push(p);
    }
  }

  const now = new Date().toISOString();
  let leads: BusinessLead[] = uniquePlaces.map((place: any, idx: number) => {
    const name = place.displayName?.text || `Business ${idx + 1}`;
    const rawPhone = place.internationalPhoneNumber || place.nationalPhoneNumber || '';
    const phone = rawPhone ? rawPhone.trim() : 'Not listed by Google Places';
    const address = place.formattedAddress || `${targetArea || 'Local'}, India`;
    const area = extractAreaFromAddress(address, targetArea);
    const category = formatCategory(
      place.primaryTypeDisplayName?.text,
      place.primaryType,
      place.types
    );

    let website = place.websiteUri || '';
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
      rating: typeof place.rating === 'number' ? place.rating : null,
      reviewCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
      operationalStatus: place.businessStatus === 'OPERATIONAL' ? 'Operational' : place.businessStatus || 'Operational',
      googleMapsUri: place.googleMapsUri || '',
      source: 'Google Places API',
      status: 'New',
      notes: phone === 'Not listed by Google Places' ? 'Phone number not provided in public Google listing' : '',
      createdAt: now,
      searchQuery: cleanQuery,
    };
  });

  // Strict Area Filter Enforcement if targetArea is specified:
  if (targetArea && targetArea.length >= 2 && strictFilter) {
    const lowerTarget = targetArea.toLowerCase();
    const strictlyFiltered = leads.filter((l) => {
      const addr = l.address.toLowerCase();
      const areaName = l.area.toLowerCase();
      const bName = l.name.toLowerCase();
      return (
        addr.includes(lowerTarget) ||
        areaName.includes(lowerTarget) ||
        bName.includes(lowerTarget)
      );
    });

    if (strictlyFiltered.length > 0) {
      leads = strictlyFiltered;
    }
  }

  // Mobile number filter if requested
  if (onlyWithMobile) {
    leads = leads.filter((l) => {
      if (!l.phone || l.phone.startsWith('Not listed')) return false;
      const digits = l.phone.replace(/\D/g, '');
      return digits.length >= 8;
    });
  }

  leads = leads.slice(0, Math.min(Math.max(pageSize, 5), 100));

  let message = '';
  if (leads.length === 0) {
    message = uniquePlaces.length > 0 && onlyWithMobile
      ? `Found ${uniquePlaces.length} businesses, but none listed a public phone number. Uncheck "Only With Mobile Numbers" to view all listings.`
      : `No businesses found matching "${cleanQuery}". Try broadening your category or area name.`;
  } else {
    message = `Successfully discovered ${leads.length} genuine businesses via Google Places API.`;
  }

  return {
    leads,
    searchQuery: cleanQuery,
    targetArea: targetArea || undefined,
    source: 'Google Places API (New)',
    attribution: 'Google Maps',
    totalFound: leads.length,
    message,
  };
}

/**
 * AI Festival & Daily Occasion Marketing Generator
 * Generates engaging festival wishes + business product promotion (Red chilli powder, EV, etc.)
 */
export async function generateSpecialDayMarketing(params: {
  date: string;
  businessName: string;
  businessType: string;
  phone: string;
  customInstructions?: string;
  stylePreset?: string;
}): Promise<{
  occasion: string;
  headline: string;
  greetingTextTelugu: string;
  greetingTextEnglish: string;
  offerHighlight: string;
  suggestedPosterColor: string;
  dallePrompt: string;
}> {
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
Style Preference: "${stylePreset || 'Cinematic 3D Luxury Gold'}"
User Specific Revision Instructions: "${customInstructions || 'Create an ultra-engaging, cinematic festival promotion'}"

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
      model: 'gemini-flash-latest',
      contents: prompt,
    });

    const text = res.text || '';
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonStr = match ? match[1].trim() : text.trim();
    const data = JSON.parse(jsonStr);

    return {
      occasion: data.occasion || 'Festival & Special Celebration Day',
      headline: data.headline || `${businessName} Festive Special`,
      greetingTextTelugu: data.greetingTextTelugu || `మీకు మరియు మీ కుటుంబ సభ్యులకు శుభాకాంక్షలు!`,
      greetingTextEnglish: data.greetingTextEnglish || `Warm festive greetings from ${businessName}!`,
      offerHighlight: data.offerHighlight || 'Special Festive Discounts Available Today!',
      suggestedPosterColor: data.suggestedPosterColor || '#dc2626',
      dallePrompt: data.dallePrompt || `Cinematic 4K festival poster celebrating ${data.occasion || 'Festival'} for ${businessName}, vibrant traditional aesthetics, studio lighting, photorealistic, 8k resolution.`,
    };
  } catch (err) {
    console.error('Gemini marketing generation fallback:', err);
    return getFallbackOccasion(date, businessName, businessType, phone, customInstructions);
  }
}

function getFallbackOccasion(
  date: string,
  businessName: string,
  businessType: string,
  phone: string,
  customInstructions?: string
) {
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const day = d.getDate();

  let occasion = 'Special Celebration Day';
  let color = '#dc2626';

  if (month === 10 && day === 2) {
    occasion = 'Gandhi Jayanti Special';
    color = '#15803d';
  } else if (month === 10 && day >= 10 && day <= 24) {
    occasion = 'Dussehra & Vijayadashami Special';
    color = '#d97706';
  } else if (month === 11 && day <= 15) {
    occasion = 'Diwali & Deepavali Festive Special';
    color = '#ea580c';
  } else if (month === 1 && day >= 13 && day <= 16) {
    occasion = 'Sankranti & Pongal Celebration';
    color = '#ca8a04';
  } else if (month === 3 || month === 4) {
    occasion = 'Ugadi & New Year Special';
    color = '#059669';
  } else {
    occasion = 'Daily Customer Special & Fresh Deals';
    color = '#dc2626';
  }

  const isChilli = businessType.toLowerCase().includes('chilli') || businessType.toLowerCase().includes('spice');

  return {
    occasion,
    headline: `${businessName} - ${occasion}`,
    greetingTextTelugu: isChilli
      ? `మీకు మరియు మీ కుటుంబానికి ${occasion} హార్ధిక శుభాకాంక్షలు! 🙏\nమా ${businessName} నుండి 100% ప్యూర్, నేచురల్ రెడ్ చిల్లీ పౌడర్ & నాణ్యమైన స్పైసెస్ పై ప్రత్యేక పండుగ ఆఫర్లు అందుబాటులో ఉన్నాయి. స్వచ్ఛమైన కారం తో మీ వంటలను మరింత రుచికరంగా చేసుకోండి!\nఆర్డర్స్ కోసం: ${phone}.`
      : `మీకు మరియు మీ కుటుంబానికి ${occasion} హార్ధిక శుభాకాంక్షలు! 🙏\nమా ${businessName} నుండి మీ వ్యాపారానికి సరికొత్త ఆఫర్లు & బెస్ట్ ప్రైసింగ్ అందిస్తున్నాము.\nమరిన్ని వివరాలకు సంప్రదించండి: ${phone}.`,
    greetingTextEnglish: isChilli
      ? `Warm wishes on this ${occasion}! 🌶️✨\nCelebrate with 100% pure, natural, vibrant red chilli powder from ${businessName}. Unmatched flavor, rich color, and pure quality for your culinary delights.\nSpecial bulk discounts available today! Contact: ${phone}.`
      : `Warm wishes on this ${occasion} from ${businessName}! ✨\nAvail exclusive discounts and special business offers today. Contact us at ${phone}.`,
    offerHighlight: customInstructions ? `Special Offer: ${customInstructions}` : 'Special Festive Discount - 100% Quality Guaranteed!',
    suggestedPosterColor: color,
    dallePrompt: `Ultra-photorealistic cinematic 4k commercial poster for ${occasion} celebrating ${businessName}, ${businessType}. Dramatic volumetric golden hour lighting, rich textures, festive decorative background, hyper-detailed 8k resolution.`,
  };
}
