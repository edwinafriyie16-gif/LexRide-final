import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { randomBytes } from "crypto";

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

  // Create a shareable ride. Returns { id } used to build the join link.
  app.post("/api/rides", (req, res) => {
    try {
      const { fromLabel, toLabel, toLat, toLng, time, seats, platform, creatorName } = req.body || {};
      if (!fromLabel || !toLabel || !time || !creatorName) {
        return res.status(400).json({ error: "Missing required ride fields" });
      }
      const id = makeRideId();
      const ride: SharedRide = {
        id,
        fromLabel,
        toLabel,
        toLat,
        toLng,
        time,
        seats: Number(seats) || 3,
        platform: platform || "Bolt",
        creatorName,
        createdAt: Date.now(),
        joined: [],
        messages: [],
      };
      sharedRides.set(id, ride);
      res.json(ride);
    } catch (error) {
      console.error("[CreateRide] Error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Fetch a shared ride by id (used by the join-via-link screen).
  app.get("/api/rides/:id", (req, res) => {
    const ride = sharedRides.get(req.params.id);
    if (!ride) return res.status(404).json({ error: "Ride not found" });
    res.json(ride);
  });

  // Join a shared ride.
  app.post("/api/rides/:id/join", (req, res) => {
    const ride = sharedRides.get(req.params.id);
    if (!ride) return res.status(404).json({ error: "Ride not found" });
    const { firstName } = req.body || {};
    if (!firstName) return res.status(400).json({ error: "Missing firstName" });
    if (ride.joined.length >= ride.seats) {
      return res.status(409).json({ error: "Ride is full" });
    }
    ride.joined.push({ id: makeRideId(), firstName, joinedAt: Date.now() });
    ride.messages.push({ id: makeRideId(), sender: "System", text: `${firstName} joined the ride 🎉`, createdAt: Date.now() });
    res.json(ride);
  });

  // Post a chat message to a ride's group chat.
  app.post("/api/rides/:id/messages", (req, res) => {
    const ride = sharedRides.get(req.params.id);
    if (!ride) return res.status(404).json({ error: "Ride not found" });
    const { sender, text } = req.body || {};
    if (!sender || !text) return res.status(400).json({ error: "Missing sender or text" });
    const trimmed = String(text).trim().slice(0, 500);
    if (!trimmed) return res.status(400).json({ error: "Message is empty" });
    ride.messages.push({ id: makeRideId(), sender: String(sender).slice(0, 40), text: trimmed, createdAt: Date.now() });
    res.json(ride);
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
