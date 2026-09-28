<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/1e93ec11-a58a-416f-9487-2449af05d408

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set `GEOAPIFY_API_KEY` in [.env.local](.env.local) to your Geoapify key. LexRide uses Geoapify for Ghana place search and estimated driving time, with the local Kumasi directory as a fallback. `GOOGLE_MAPS_API_KEY` and `GEMINI_API_KEY` remain supported as optional fallbacks.
3. Set the existing LexRide Supabase project credentials in the local environment and in Vercel:
   - `SUPABASE_URL=https://cyksgpuhtbxuggipcwtj.supabase.co`
   - `SUPABASE_ANON_KEY=<the project's public anon/publishable key>`

The API now stores shared trips, join requests, approvals, and trip-room messages in the existing Supabase LexRide project. The database migration `add_lexride_trip_rooms` creates the `lexride_trip_rooms`, `lexride_trip_members`, and `lexride_trip_messages` tables. Do not commit `.env.local` or any secret key.
4. Run the app:
   `npm run dev`
