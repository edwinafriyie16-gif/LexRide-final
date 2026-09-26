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
3. Run the app:
   `npm run dev`
