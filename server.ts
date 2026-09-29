import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { randomBytes } from "crypto";
import { addMessage, canAccessTripChat, createRide, getRide, joinRide } from "./api/_rideStore.js";
import { deleteSession, getAccountFromToken, readCookie, signIn, signUp } from "./api/_authStore.js";

interface SharedRideJoiner {
  id: string;
  firstName: string;
  joinedAt: number;
}

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  createdAt: number;
}

interface SharedRide {
  id: string;
  fromLabel: string;
  toLabel: string;
  toLat?: number;
  toLng?: number;
  time: string;
  seats: number;
  platform: string;
  creatorName: string;
  createdAt: number;
  joined: SharedRideJoiner[];
  messages: ChatMessage[];
}

// In-memory store. Fine for a prototype; swap for a real DB (Postgres/Redis)
// before relying on this across server restarts or multiple instances.
const sharedRides = new Map<string, SharedRide>();
const localPlaces = [
  ["Adum", "Adum, Kumasi, Ashanti Region, Ghana", 6.689568, -1.618825], ["Kumasi", "Kumasi, Ashanti Region, Ghana", 6.700071, -1.630783],
  ["Ayeduase", "Ayeduase, Kumasi, Ashanti Region, Ghana", 6.675, -1.55944], ["Ayeduase Newsite", "Ayeduase Newsite, Kumasi, Ashanti Region, Ghana", 6.675647, -1.563221],
  ["Kromuase", "Kromuase, Atwima Kwanwoma, Ashanti Region, Ghana", 6.673, -1.690], ["Kromoase", "Kromoase, Atwima Kwanwoma, Ashanti Region, Ghana", 6.673, -1.690],
  ["KNUST", "Kwame Nkrumah University of Science and Technology, Kumasi, Ghana", 6.6745, -1.5716], ["Kejetia", "Kejetia, Kumasi, Ashanti Region, Ghana", 6.697, -1.624],
  ["Bantama", "Bantama, Kumasi, Ashanti Region, Ghana", 6.702, -1.642], ["Suame", "Suame, Kumasi, Ashanti Region, Ghana", 6.716, -1.62],
  ["Asokwa", "Asokwa, Kumasi, Ashanti Region, Ghana", 6.673, -1.603], ["Ahodwo", "Ahodwo, Kumasi, Ashanti Region, Ghana", 6.686, -1.612],
  ["Tech Junction", "Tech Junction, Kumasi, Ghana", 6.674, -1.577], ["Ejisu", "Ejisu, Ashanti Region, Ghana", 6.728, -1.478],
];
const localSearch = (query: string) => { const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean); return localPlaces.filter(([name, address]) => terms.every((term) => `${name} ${address}`.toLowerCase().includes(term))).slice(0, 8).map(([name, formatted_address, lat, lng]) => ({ name, formatted_address, geometry: { location: { lat, lng } }, source: "LexRide Kumasi directory" })); };

function makeRideId(): string {
  return randomBytes(4).toString("hex");
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY;
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GEMINI_API_KEY;

  app.use(express.json());

  const sessionCookie = (token: string, maxAge = 2592000) => `lexride_session=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { fullName, sex, password } = req.body || {};
      if (!fullName || !sex || !password) return res.status(400).json({ error: "Name, sex, and password are required" });
      if (sex !== "Male" && sex !== "Female") return res.status(400).json({ error: "Sex must be Male or Female" });
      const result = await signUp(fullName, sex, password);
      res.setHeader("Set-Cookie", sessionCookie(result.token));
      return res.status(201).json({ account: result.account });
    } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : "Could not create account" }); }
  });
  app.post("/api/auth/signin", async (req, res) => {
    try {
      const { fullName, password } = req.body || {};
      if (!fullName || !password) return res.status(400).json({ error: "Name and password are required" });
      const result = await signIn(fullName, password);
      res.setHeader("Set-Cookie", sessionCookie(result.token));
      return res.json({ account: result.account });
    } catch (error) { return res.status(401).json({ error: error instanceof Error ? error.message : "Could not sign in" }); }
  });
  app.get("/api/auth/me", async (req, res) => {
    try { return res.json({ account: await getAccountFromToken(readCookie(req.headers.cookie, "lexride_session")) }); }
    catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : "Could not read session" }); }
  });
  app.post("/api/auth/signout", async (req, res) => {
    try { await deleteSession(readCookie(req.headers.cookie, "lexride_session")); res.setHeader("Set-Cookie", sessionCookie("", 0)); return res.json({ ok: true }); }
    catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : "Could not sign out" }); }
  });

  // Shared rides use the same Supabase-backed store as the Vercel handlers.
  app.post("/api/rides", async (req, res) => {
    try {
      const account = await getAccountFromToken(readCookie(req.headers.cookie, "lexride_session"));
      if (!account) return res.status(401).json({ error: "Sign in required" });
      const { fromLabel, toLabel, toLat, toLng, date, time, seats, platform } = req.body || {};
      if (!fromLabel || !toLabel || !time) return res.status(400).json({ error: "Missing required ride fields" });
      return res.json(await createRide({ fromLabel, toLabel, toLat, toLng, date, time, seats, platform, creatorName: account.fullName, creatorSex: account.sex, creatorAccountId: account.id }));
    } catch (error) {
      console.error("[CreateRide] Error:", error);
      return res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/rides/:id", async (req, res) => {
    try {
      const ride = await getRide(req.params.id);
      if (!ride) return res.status(404).json({ error: "Ride not found" });
      res.setHeader("Cache-Control", "private, no-store");
      const account = await getAccountFromToken(readCookie(req.headers.cookie, "lexride_session"));
      const canReadChat = account ? await canAccessTripChat(req.params.id, account.id) : false;
      return res.json(canReadChat ? ride : { ...ride, messages: [] });
    } catch (error) {
      console.error("[GetRide] Error:", error);
      return res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/rides/:id/join", async (req, res) => {
    try {
      const account = await getAccountFromToken(readCookie(req.headers.cookie, "lexride_session"));
      if (!account) return res.status(401).json({ error: "Sign in required" });
      const result = await joinRide(req.params.id, account.fullName, account.sex, account.id);
      if ("error" in result) return res.status(result.status).json({ error: result.error });
      return res.json(result);
    } catch (error) {
      console.error("[JoinRide] Error:", error);
      return res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/rides/:id/messages", async (req, res) => {
    try {
      const account = await getAccountFromToken(readCookie(req.headers.cookie, "lexride_session"));
      if (!account) return res.status(401).json({ error: "Sign in required" });
      const { text } = req.body || {};
      if (typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "Message is empty" });
      if (!(await canAccessTripChat(req.params.id, account.id))) return res.status(403).json({ error: "Only the trip host and approved passengers can access this chat" });
      const result = await addMessage(req.params.id, account.fullName, text, account.sex);
      if ("error" in result) return res.status(result.status).json({ error: result.error });
      return res.json(result);
    } catch (error) {
      console.error("[AddMessage] Error:", error);
      return res.status(500).json({ error: String(error) });
    }
  });

  // API Proxy for Google Nearby Search (Places API New)
  app.get("/api/nearbysearch", async (req, res) => {
    const { location, radius } = req.query;
    console.log(`[NearbySearch] loc: ${location}, rad: ${radius}`);
    
    try {
      if (!GOOGLE_MAPS_API_KEY) throw new Error("Missing API Key");

      const coords = (location as string).split(',');
      const lat = parseFloat(coords[0]);
      const lng = parseFloat(coords[1]);

      if (isNaN(lat) || isNaN(lng)) throw new Error("Invalid Coords");

      const url = `https://places.googleapis.com/v1/places:searchNearby`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'places.displayName,places.location,places.types,places.formattedAddress,places.shortFormattedAddress'
        },
        body: JSON.stringify({
          maxResultCount: 12,
          locationRestriction: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: Number(radius) || 500
            }
          },
          includedTypes: ["gas_station", "bank", "restaurant", "fast_food"]
        })
      });

      const data = await response.json();
      
      const legacyFormatted = {
        status: response.ok ? 'OK' : 'ERROR',
        results: (data.places || []).map((p: any) => ({
          name: p.displayName?.text || 'Place',
          geometry: { location: { lat: p.location.latitude, lng: p.location.longitude } },
          types: p.types || [],
          vicinity: p.shortFormattedAddress || p.formattedAddress || ''
        }))
      };
      
      res.json(legacyFormatted);
    } catch (error) {
      console.error('[NearbySearch] Error:', error);
      res.status(500).json({ status: 'ERROR', error: String(error) });
    }
  });

  // API Proxy for Google Reverse Geocoding
  app.get("/api/reverse-geocode", async (req, res) => {
    const { latlng } = req.query;
    console.log(`[ReverseGeocode] ${latlng}`);
    try {
      if (!GOOGLE_MAPS_API_KEY) throw new Error("Missing API Key");
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latlng}&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('[ReverseGeocode] Error:', error);
      res.status(500).json({ status: 'ERROR', error: String(error) });
    }
  });

  app.get("/api/reverse", async (req, res) => {
    const latitude = Number(req.query.lat);
    const longitude = Number(req.query.lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return res.status(400).json({ status: "INVALID_COORDINATES" });
    try {
      if (GEOAPIFY_API_KEY) {
        const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude), apiKey: GEOAPIFY_API_KEY });
        const response = await fetch(`https://api.geoapify.com/v1/geocode/reverse?${params.toString()}`);
        const data = await response.json();
        const properties = data.features?.[0]?.properties;
        if (response.ok && properties) return res.json({ status: "OK", source: "Geoapify", result: { name: properties.name || properties.city || properties.suburb || properties.district || "Current location", formatted_address: properties.formatted || "Current location", geometry: { location: { lat: latitude, lng: longitude } } } });
      }
      return res.json({ status: "OK", source: "Device GPS", result: { name: "Your current location", formatted_address: `GPS location · ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, geometry: { location: { lat: latitude, lng: longitude } } } });
    } catch (error) {
      console.error('[Reverse] Error:', error);
      return res.json({ status: "OK", source: "Device GPS", result: { name: "Your current location", formatted_address: `GPS location · ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, geometry: { location: { lat: latitude, lng: longitude } } } });
    }
  });

  // API Proxy for Google Text Search (Destinations)
  app.get("/api/textsearch", async (req, res) => {
    const { query, location, radius, region } = req.query;
    console.log(`[TextSearch] query: ${query}`);
    try {
      if (GEOAPIFY_API_KEY) {
        const params = new URLSearchParams({ text: `${String(query || "")}, Ghana`, filter: "countrycode:gh", limit: "8", apiKey: GEOAPIFY_API_KEY });
        const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`);
        const data = await response.json();
        const results = (data.features || []).map((feature: any) => ({ name: feature.properties.name || feature.properties.formatted || "Location", formatted_address: feature.properties.formatted || "Ghana", geometry: { location: { lat: feature.properties.lat, lng: feature.properties.lon } }, source: "Geoapify" }));
        return res.status(response.ok ? 200 : 502).json({ status: response.ok && results.length ? "OK" : response.ok ? "ZERO_RESULTS" : "GEOAPIFY_ERROR", source: "Geoapify", results });
      }
      if (!GOOGLE_MAPS_API_KEY) return res.json({ status: localSearch(String(query || "")).length ? "OK" : "ZERO_RESULTS", source: "LexRide directory", results: localSearch(String(query || "")) });
      const url = `https://places.googleapis.com/v1/places:searchText`;
      const body: any = {
        textQuery: query,
        regionCode: region || 'GH',
        maxResultCount: 10
      };

      if (location && radius) {
        const [lat, lng] = (location as string).split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {
          body.locationBias = {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: Number(radius) || 20000
            }
          };
        }
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.shortFormattedAddress,places.types'
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      const legacyFormatted = {
        status: response.ok ? 'OK' : 'ZERO_RESULTS',
        results: (data.places || []).map((p: any) => ({
          name: p.displayName?.text || '',
          formatted_address: p.formattedAddress || p.shortFormattedAddress || '',
          geometry: { location: { lat: p.location.latitude, lng: p.location.longitude } }
        }))
      };
      if (!data.places || data.places.length === 0) legacyFormatted.status = 'ZERO_RESULTS';
      res.json(legacyFormatted);
    } catch (error) {
      console.error('[TextSearch] Error:', error);
      res.status(500).json({ status: 'ERROR', error: String(error) });
    }
  });

  // API Proxy for Google Directions
  app.get("/api/directions", async (req, res) => {
    const { origin, destination } = req.query;
    console.log(`[Directions] from: ${origin} to: ${destination}`);
    try {
      if (GEOAPIFY_API_KEY) {
        const response = await fetch(`https://api.geoapify.com/v1/routing?waypoints=${encodeURIComponent(String(origin || "") + "|" + String(destination || ""))}&mode=drive&format=json&apiKey=${encodeURIComponent(GEOAPIFY_API_KEY)}`);
        const data = await response.json(); const route = data.features?.[0];
        return res.status(response.ok && route ? 200 : 502).json({ status: response.ok && route ? "OK" : "GEOAPIFY_ERROR", source: "Geoapify", routes: route ? [{ duration: route.properties.time, distance: route.properties.distance, geometry: route.geometry }] : [] });
      }
      if (!GOOGLE_MAPS_API_KEY) return res.json({ status: "ZERO_RESULTS", routes: [] });
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('[Directions] Error:', error);
      res.status(500).json({ status: 'ERROR', error: String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
