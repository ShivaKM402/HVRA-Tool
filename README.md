# HVRA Digital Tool

**Hazard, Vulnerability, Exposure and Risk Assessment Tool**

A query-driven GIS-based tool for administrative-level hazard assessment.

> ⚠️ **PROTOTYPE** — This is a working prototype for demonstration purposes.
> All seed data is clearly labelled as **DEMO DATA** and does not represent official government data.

---

# HVRA Digital Platform

**Kerala Hazard, Vulnerability, Exposure and Risk Assessment (HVRA) Platform**

An end-to-end spatial decision support system providing query-driven administrative-level hazard scoring, composite risk matrix modeling ($Risk = H \times V \times Amount$), KSDMA HVRA thematic atlas integration, multi-stage approval governance, and publication-grade PDF/DOCX reporting with embedded 220-DPI choropleth maps.

---

## Repository Structure

```
Flood/
├── backend/                  # Django 4.2 REST Framework & Spatial GIS engine
│   ├── apps/                 # Modular domain apps (accounts, spatial, assessments, risk, queries, reports)
│   ├── config/               # Django settings, WSGI/ASGI, base routing
│   ├── fixtures/             # Administrative GeoJSON boundaries & seed datasets
│   ├── requirements.txt      # Backend Python dependencies
│   └── manage.py
├── frontend/                 # React 19 + TypeScript + Vite web application
│   ├── src/
│   │   ├── components/       # Shared UI (Layout, Leaflet/MapLibre maps, Modals, Tour)
│   │   ├── context/          # Global state (AuthContext, DistrictContext, ToastContext)
│   │   ├── pages/            # Domain-driven page groups (auth, dashboard, assessments, risk, data-governance, portal)
│   │   ├── services/         # Typed API clients & Axios interceptors
│   │   └── types/            # TypeScript interfaces & domain models
│   ├── package.json
│   └── vite.config.ts
├── docs/                     # Documentation & specifications
│   ├── ARCHITECTURE.md       # Detailed architectural guide & domain mapping
│   └── specs/                # Platform specifications & rework blueprints
├── .env.example              # Sample environment configuration
├── .gitignore
├── README.md                 # Project overview and quickstart guide
└── requirements.txt          # Root pointer to backend dependencies
```

---

## Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS tokens / Vanilla CSS, Leaflet, MapLibre GL, Recharts, Lucide Icons |
| **Backend** | Python 3.10+, Django 4.2 LTS, Django REST Framework, SQLite / SpatiaLite |
| **Spatial / GIS** | GeoPandas, Shapely 2.0, Fiona, PyProj, Matplotlib |
| **Reporting** | ReportLab 4.2 (NumberedCanvas running headers/footers, embedded GIS maps), python-docx |

---

## Quick Start

### 1. Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows PowerShell / CMD
# source venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo_data
python manage.py runserver 8000
```
Backend runs at: `http://localhost:8000`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```
Frontend runs at: `http://localhost:5173`

---

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Comprehensive guide to backend domain apps, frontend feature organization, and design conventions.
- [docs/specs/hvra-platform-rework-spec.md](docs/specs/hvra-platform-rework-spec.md) — Platform technical specification and feature requirements.

