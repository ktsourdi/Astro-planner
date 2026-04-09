# Astro-MVP 🌌

A simple astronomy planning web app built with **Next.js** and deployable on **Vercel**.  
It helps astrophotographers plan their sessions by combining **location, equipment, weather, moon, and light pollution** into target recommendations and capture settings.

---

## 📱 Mobile app (Flutter)

A Flutter mobile client is available in `/flutter_app` and uses the existing Next.js API routes:
- `GET /api/recommend`
- `GET /api/camera`
- `GET /api/image`
- `GET /api/plan`
- `GET /api/planner`

### Run web backend
```bash
npm ci
npm run dev
```

### Run Flutter app
```bash
cd flutter_app
flutter pub get
flutter run
```

Default backend URL is `http://10.0.2.2:3000` on Android emulator, and `http://localhost:3000` on other platforms.

To override backend URL for dev/staging/prod:
```bash
flutter run --dart-define=ASTRO_BASE_URL=https://your-backend.example.com
```

### API contract compatibility

All API routes now include:
- JSON payload field: `contract.version`
- Response header: `X-Astro-Contract-Version`

Current version: `2026-04-09`

Web and Flutter clients are expected to remain compatible with this contract version or newer.

## ✨ Features
- Input your **location** and **setup** (sensor, pixel size, focal length, f-ratio, mount, camera gain).
- Choose a **target** (e.g., Andromeda) or let the app **recommend** suitable ones.
- Plan multi-night windows with filtering by range, target type, score, and minimum altitude.
- Calculates:
  - **Visibility windows** (altitude, night time).
  - **Weather** (cloud cover via Open-Meteo).
  - **Moon phase/altitude**.
  - **Framing** (object size vs field of view).
- Shows score diagnostics: visibility, framing, season, moon, and weather components.
- Suggests **capture settings**: exposure time, Gain, number of subs.
- Local catalog of **Messier/NGC objects**.
- Deployable 100% on Vercel (serverless API routes).

---
