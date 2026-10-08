# RoamIQ 🧭 — Smart Travel Planner & Discovery

> An intelligent, AI-orchestrated travel planning platform built with React, Vite, Tailwind CSS, Leaflet, and Supabase. RoamIQ helps travelers discover hidden gems, generate slot-based itineraries, sync stops with interactive maps, organize trip assets, and track group expenses.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18%2B%20%2F%2019-61dafb.svg?logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646cff.svg?logo=vite)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3%2Fv4-38bdf8.svg?logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Backend-Supabase-3ecf8e.svg?logo=supabase)](https://supabase.com/)
[![Gemini AI](https://img.shields.io/badge/AI-Gemini%20Flash-orange.svg?logo=google)](https://ai.google.dev/)

---

## 🌟 Key Features

* **🧠 AI Itinerary Generator:** Generate multi-day, time-slot structured (Morning, Afternoon, Evening) itineraries constrained by persona, budget, pacing, and geo-coordinates using Google Gemini Flash structured JSON outputs.
* **🗺️ Interactive Map Sync (Leaflet):** Real-time bidirectional highlighting between day-by-day itinerary cards and custom interactive map pins.
* **📍 Destination & Gem Discovery:** Search global destinations with live weather summaries (Open-Meteo) and filterable landmark categories.
* **👥 Collaborative Co-Planning:** Asynchronous multi-user access via Supabase Row-Level Security (RLS) permissions.
* **📂 Document & Ticket Vault:** Secure document, ticket, and booking storage with client previews powered by Supabase Storage.
* **🧳 Smart Contextual Packing:** Automated weather-aware and activity-aware packing checklists.
* **🧾 Budget Splitter & Expense Tracker:** Track expenditures grouped by category (Stay, Food, Transport, Misc) with real-time balance calculations.
* **📱 Responsive & Offline-Ready:** Mobile-first layout with offline cache resilience using TanStack Query & `localStorage`.

---

## 🏗️ Architecture & Tech Stack

```
┌──────────────────────────────────────────────────────────┐
│                      RoamIQ Client                       │
│  React (Vite) + Tailwind CSS + shadcn/ui + Lucide Icons  │
│  State: Zustand (UI State) + TanStack Query (Server)     │
└──────────────┬────────────────────────────┬──────────────┘
               │                            │
               ▼                            ▼
┌──────────────────────────────┐   ┌────────────────────────────────┐
│   Backend-as-a-Service       │   │    External Intelligence APIs  │
│   (Supabase)                 │   │                                │
│   • Auth (Email / OAuth)     │   │   • Google Gemini Flash (AI)   │
│   • PostgreSQL DB (RLS)      │   │   • Open-Meteo (Live Weather)  │
│   • Storage (Tickets/Media)  │   │   • OpenStreetMap / Leaflet    │
│   • Edge Functions (Optional)│   │   • Nominatim / GeoDB Search   │
└──────────────────────────────┘   └────────────────────────────────┘
```

---

## 📁 Repository Structure

```
roamiq/
├── .github/                  # CI/CD workflows (GitHub Actions to Vercel/Cloudflare)
├── public/                   # Static assets, icons, manifest
├── src/
│   ├── assets/               # Local images, SVG illustrations
│   ├── components/           # Reusable UI primitives (shadcn/ui, buttons, modals)
│   │   ├── common/           # Navbar, Footer, Loading states, Error boundaries
│   │   ├── map/              # Leaflet map container, custom pins, polyline routes
│   │   └── ui/               # Radix/shadcn atom components (Dialog, Dropdown, Tabs)
│   ├── features/             # Domain-driven feature modules
│   │   ├── auth/             # Login, Signup, MagicLink, Profile hooks
│   │   ├── explore/          # Destination search, place cards, filters
│   │   ├── itinerary/        # Day timelines, stop cards, drag-and-drop order
│   │   ├── planner/          # Multi-step AI trip wizard dialog
│   │   ├── organizer/        # File vault, document upload, ticket viewer
│   │   ├── packing/          # AI packing checklist, category tags
│   │   └── expenses/         # Budget summary, expense inputs, split calculator
│   ├── hooks/                # Custom React hooks (useMapSync, useDebounce, etc.)
│   ├── lib/                  # Shared utilities
│   │   ├── ai.ts             # Google Gemini client & prompt definitions
│   │   ├── supabase.ts       # Supabase client instantiation
│   │   ├── weather.ts        # Open-Meteo API wrapper
│   │   └── utils.ts          # Tailwind cn merge & formatting helpers
│   ├── stores/               # Zustand state stores (activeDay, selectedPlace, mapCenter)
│   ├── types/                # TypeScript declarations and Zod schemas
│   │   ├── trip.ts           # Trip and Itinerary item definitions
│   │   └── schema.ts         # Zod schemas for AI response validation
│   ├── App.tsx               # App entry with React Router switch
│   ├── main.tsx              # React DOM render root
│   └── index.css             # Tailwind base and custom map animations
├── supabase/
│   └── migrations/           # SQL migration scripts with RLS policies
├── .env.example              # Sample environment variables
├── package.json              # Project dependencies & scripts
├── tsconfig.json             # TypeScript configuration
├── tailwind.config.js        # Tailwind theme and plugin setup
└── vite.config.ts            # Vite build configuration
```

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: v18.x or v20.x+
* **Package Manager**: `npm` or `pnpm`
* **Accounts (Free Tier)**:
  * [Supabase](https://supabase.com) (Database, Auth, and Storage)
  * [Google AI Studio](https://aistudio.google.com/) (Gemini Flash API Key)

### 1. Clone & Install
```bash
git clone https://github.com/your-username/roamiq.git
cd roamiq
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Update `.env.local` with your credentials:
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# AI Intelligence (Google Gemini Flash)
VITE_GEMINI_API_KEY=your-gemini-api-key

# Optional Tile / Geocoding Keys (Leave empty for standard OSM)
VITE_MAP_TILE_PROVIDER=osm
```

### 3. Setup Supabase Database Schema
Navigate to your Supabase project's **SQL Editor** and execute the migration file located at:
`supabase/migrations/20260101_init_schema.sql`

This sets up:
* `trips` table with user attribution
* `itinerary_items` with geo-coordinates and day tracking
* `trip_members` for group access
* `expenses` for budget splitting
* Row-Level Security (RLS) policies allowing users to only access trips they own or belong to.

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🤖 AI Prompting & Autonomous Hermes Agent Workflow

This repository is optimized for autonomous development using the **Hermes Agent**.

### Development Convention for Hermes:
1. **Component Atomicity:** Place visual components in `src/features/<feature-name>/components/`.
2. **Strict Zod Validations:** All AI-generated responses from Gemini must be parsed against `src/types/schema.ts` before updating Supabase or local state.
3. **Map Canvas Safety:** Leaflet instances must always be cleaned up on unmount to prevent `Map container is already initialized` runtime errors.
4. **No Direct Secret Exposure:** Never commit `.env` or service role keys. Client-side calls strictly use `VITE_SUPABASE_ANON_KEY`.

---

## 🚢 Deployment (100% Free Tier)

### Frontend (Vercel / Cloudflare Pages)
1. Push your repository to GitHub.
2. Link the repository to **Vercel** or **Cloudflare Pages**.
3. Set build configuration:
   * **Framework Preset:** Vite
   * **Build Command:** `npm run build`
   * **Output Directory:** `dist`
4. Add environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GEMINI_API_KEY`) under Project Settings.
5. Deploy!

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for details.