import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const GOOGLE_MAPS_API_KEY = process.env.GEMINI_API_KEY;

  app.use(express.json());

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

  // API Proxy for Google Text Search (Destinations)
  app.get("/api/textsearch", async (req, res) => {
    const { query, location, radius, region } = req.query;
    console.log(`[TextSearch] query: ${query}`);
    try {
      if (!GOOGLE_MAPS_API_KEY) throw new Error("Missing API Key");
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
      if (!GOOGLE_MAPS_API_KEY) throw new Error("Missing API Key");
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
