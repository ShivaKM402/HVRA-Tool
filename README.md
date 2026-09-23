# HVRA Digital Tool

**Hazard, Vulnerability, Exposure and Risk Assessment Tool**

A query-driven GIS-based tool for administrative-level hazard assessment.

> ⚠️ **PROTOTYPE** — This is a working prototype for demonstration purposes.
> All seed data is clearly labelled as **DEMO DATA** and does not represent official government data.

---

## Project Structure

```
Flood/
├── backend/                  # Django + DRF backend
│   ├── config/               # Django project settings
│   ├── apps/
│   │   ├── administration/   # Administrative units (State/District/Block)
│   │   ├── hazards/          # Hazard events and layers
│   │   ├── datasets/         # Data sources and uploads
│   │   ├── assessments/      # Assessment workflow
│   │   └── reports/          # Report generation
│   ├── gis/                  # GIS processing layer
│   │   ├── spatial.py
│   │   ├── overlays.py
│   │   └── geometry.py
│   ├── scoring/              # Scoring engine
│   │   ├── normalization.py
│   │   ├── weightage.py
│   │   ├── scoring.py
│   │   └── classification.py
│   ├── manage.py
│   └── requirements.txt
├── frontend/                 # React + TypeScript + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── types/
│   │   ├── hooks/
│   │   └── utils/
│   └── package.json
├── .env.example
└── README.md
```

---

## Technology Stack

| Layer       | Technology                                  |
|-------------|---------------------------------------------|
| Frontend    | React 18 + TypeScript + Vite                |
| Mapping     | Leaflet + React-Leaflet                     |
| Backend     | Python 3.10+ / Django 4.2 / DRF             |
| Database    | SQLite                                      |
| GIS         | GeoPandas + Shapely + Fiona                 |
| Reports     | python-docx + ReportLab                     |

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- pip

### 1. Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate      # Windows
pip install -r requirements.txt
cp ../.env.example .env
python manage.py migrate
python manage.py seed_demo_data
python manage.py runserver
```

Backend: http://localhost:8000

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173

### 3. Health Check

```
GET http://localhost:8000/api/health/
```

---

## Development Phases

| Phase | Description                          | Status      |
|-------|--------------------------------------|-------------|
| 1     | Project Setup                        | ✅ Complete  |
| 2     | Administrative Boundaries + Seed Data | 🔲 Pending  |
| 3     | Flood Events + Flood-prone Layers    | 🔲 Pending  |
| 4     | Query Builder                        | 🔲 Pending  |
| 5     | GIS Processing                       | 🔲 Pending  |
| 6     | Scoring + Classification             | 🔲 Pending  |
| 7     | Interactive Maps                     | 🔲 Pending  |
| 8     | Tables + Charts                      | 🔲 Pending  |
| 9     | PDF/DOCX Report                      | 🔲 Pending  |
| 10    | Testing + Polishing                  | 🔲 Pending  |

---

## Notes

- **DEMO DATA**: All seeded data is for demonstration purposes only.
- SQLite is used for the prototype.
- Vulnerability, Exposure and Risk modules are architecturally planned but not implemented.
