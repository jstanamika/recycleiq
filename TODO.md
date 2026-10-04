# RecycleIQ implementation checklist

## Branding, and installability

- Build a complete Progressive Web App named **RecycleIQ** for the project **“Smarter Recycling: Using AI to Identify Recyclable and Non-Recyclable Waste.”**
- Use the app name **RecycleIQ** and tagline **“Scan. Sort. Sustain.”** consistently in the page title, manifest, header, splash screen, footer, About content, README, and install prompts.
- Provide a simple inline SVG logo combining recycling arrows with a brain/circuit or lightbulb motif in green tones; use it in the header, splash screen, favicon, and app icon sources.
- Include a valid `manifest.json` with `name: "RecycleIQ"`, `short_name: "RecycleIQ"`, description, theme/background colors, `display: "standalone"`, `start_url`, `scope`, and 192×192 and 512×512 regular and maskable icons.
- Include a service worker that precaches the application shell and local assets/data and makes the app work offline after the first load.
- Show a custom **Install RecycleIQ** button using `beforeinstallprompt` on Android/desktop and a small iOS Safari instruction banner reading **“Tap Share → Add to Home Screen”**.
- Support Android, iPhone/iPad, Windows, macOS, Linux, and modern browsers with a responsive mobile-first layout from 360px to 4K, no horizontal scrolling, and touch-friendly controls with minimum 44px targets.
- Support light and dark modes following system preference with a manual theme toggle; respect `prefers-reduced-motion`; provide accessible semantic HTML, ARIA labels, keyboard navigation, visible focus, and strong contrast.

## AI waste scanner

- Provide live camera capture with the rear camera preferred by default, image upload/gallery input, and desktop drag-and-drop.
- Run image classification in the browser using a TensorFlow.js/MobileNet or Teachable Machine adapter loaded from a CDN when available, with the model source and label mapping isolated in a separately commented configuration module so a custom model can be swapped via one config line.
- Map model predictions to waste categories and show item name, confidence percentage, category, recyclable status (**Recyclable**, **Not Recyclable**, or **Special Handling**), correct bin, and 2–3 disposal tips.
- If confidence is below 60%, show a clear **Not sure** state and allow manual correction of the result.
- Display the privacy note **“Your image never leaves your device”**.
- Provide friendly error/help states for camera denial, unsupported browsers, model unavailability, missing first-load network, and reset/remove-preview actions.

## Manual search and guide

- Provide autocomplete search over at least 80 common waste items including examples such as plastic bottle, pizza box, tetra pak, batteries, e-waste, glass jar, styrofoam/thermocol, chip packets, tissue paper, cooking oil, medicine strips, and light bulbs.
- Each item record must include name, material, recyclable value (yes/no/conditional), bin color, preparation steps, category, disposal tips, and an environmental fact.
- Provide guide cards for Plastic, Paper & Cardboard, Glass, Metal, Organic/Wet waste, E-waste, Hazardous, Textiles, and Medical.
- Use configurable bin colors/mapping: green wet/organic, blue dry/recyclable, red hazardous/e-waste, black/grey non-recyclable; keep the mapping in a separate configuration file so it can adapt to a city/country.

## Dashboard and gamification

- Save scan history locally using localStorage or IndexedDB only; no backend, account, or login is required.
- Show items scanned, recyclable percentage, estimated CO2 saved, a weekly chart, streak counter, badges, and a RecycleIQ eco-score based on sorting and quiz results.
- Include badges such as **First Scan**, **Eco Warrior**, and **10-Day Streak**, plus accessible empty/locked/progress states.

## Learn and quiz

- Provide educational content for **How does the AI identify waste?**, **Why contamination ruins recycling**, **Plastic resin codes 1–7 explained**, **Reduce → Reuse → Recycle**, and **Waste problem facts**.
- Provide a 10-question **Test your RecycleIQ** quiz with instant feedback, score, retry, and score integration.

## How It Works, About, and Settings

- Show the visual pipeline **Image → Preprocessing → Neural Network (CNN) → Prediction → Category → Disposal advice**.
- Include About content for RecycleIQ, problem statement, objectives, methodology, technologies used, limitations, future scope, and editable placeholder team members.
- Include settings for English + Hindi + Punjabi with translations in a separate JSON file structured for extension, manual theme toggle, clear-history action, camera permission help, and text-size option.

#