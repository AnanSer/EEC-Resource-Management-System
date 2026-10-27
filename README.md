# Ethiopian Engineering Corporation (EEC) — Resource Management System (RMS)

Enterprise Resource Management System (RMS) designed for the Ethiopian Engineering Corporation to manage capital resources across departments and nationwide civil engineering project sites.

## System Architecture

The RMS is designed as an independently organized monorepo:

- **`frontend/`** — Client-side Single Page Application (SPA) built with React 18, Vite, TypeScript, Tailwind CSS, and React Router v6.
- **`backend/`** — RESTful API service built with Node.js, Express, TypeScript, and Prisma ORM connecting to PostgreSQL.
- **`docs/handover/`** — Preserved original 8 EEC technical handover documents.
- **`docs/RMS-IMPLEMENTATION-PLAN.md`** — Comprehensive architectural analysis and implementation roadmap.

## EEC Brand Design Tokens

| Token | Hex Code | Visual Application |
| :--- | :--- | :--- |
| **Primary Teal** | `#083D4A` | Top navigation, primary headers, buttons |
| **Electric Cyan** | `#00A7D6` | Focus rings, accents, active links, highlight borders |
| **Terracotta** | `#C96F59` | Active state indicators, priority badges, alerts |
| **Background Canvas** | `#F4F8FA` | High-contrast cool grey-blue workspace background |
| **Card Surface** | `#FFFFFF` | Elevated cards, forms, tables, modals |

## Quick Start

### 1. Install Dependencies

You can install all dependencies from the repository root:

```bash
npm run install:all
```

Or independently within each folder:

```bash
# Frontend
cd frontend
npm install

# Backend
cd backend
npm install
```

### 2. Environment Setup

Copy `.env.example` templates to `.env` in both packages:

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env
```

### 3. Run Development Servers

From repository root:

```bash
# Run both Frontend & Backend concurrently
npm run dev

# Or run separately
npm run dev:frontend    # Starts Vite on http://localhost:5173
npm run dev:backend     # Starts Express API on http://localhost:5000
```

### 4. Build & Type Check

```bash
# Type check both frontend and backend
npm run type-check

# Production build for both packages
npm run build
```

## API Health Check

The backend exposes a health status endpoint:
- **URL:** `GET http://localhost:5000/api/health`
- **Response:**
  ```json
  {
    "status": "healthy",
    "service": "EEC-RMS-Backend",
    "timestamp": "2026-10-27T01:00:00.000Z",
    "version": "1.0.0"
  }
  ```
