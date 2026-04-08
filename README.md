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

On Android emulator, use `http://10.0.2.2:3000` as backend URL in the app.

## ✨ Features
- Input your **location** and **setup** (sensor, pixel size, focal length, f-ratio, mount, camera gain).
- Choose a **target** (e.g., Andromeda) or let the app **recommend** suitable ones.
- Calculates:
  - **Visibility windows** (altitude, night time).
  - **Weather** (cloud cover via Open-Meteo).
  - **Moon phase/altitude**.
  - **Framing** (object size vs field of view).
- Suggests **capture settings**: exposure time, Gain, number of subs.
- Local catalog of **Messier/NGC objects**.
- Deployable 100% on Vercel (serverless API routes).

---
