# HVRA Digital Platform — System Architecture & Repository Layout

This document outlines the organized repository architecture, backend domain services, frontend feature domains, and design conventions for the Kerala Hazard, Vulnerability, and Risk Assessment (HVRA) Digital Platform.

---

## 1. Top-Level Repository Structure

The repository is divided into clean, decoupled workspaces:

```
Flood/
├── backend/                  # Django REST Framework backend & GIS engine
│   ├── apps/                 # Domain-driven modular Django applications
│   ├── config/               # Settings, WSGI/ASGI, base URLs
│   ├── fixtures/             # GeoJSON boundaries & seed administrative data
│   ├── requirements.txt      # Python dependencies (GIS, ReportLab, Matplotlib)
│   └── manage.py
├── frontend/                 # React 19 + TypeScript + Vite web application
│   ├── src/
│   │   ├── components/       # Shared UI components (Layout, Map, Modals, etc.)
│   │   ├── context/          # Global React contexts (Auth, District, Toast)
│   │   ├── pages/            # Domain-driven feature page groups
│   │   ├── services/         # Axios API client & typed API endpoints
│   │   └── types/            # TypeScript data contracts & schemas
│   ├── package.json
│   └── vite.config.ts
├── docs/                     # Platform specifications, design guides, architecture
│   ├── specs/                # Product specifications & rework specs
│   └── ARCHITECTURE.md       # This file
├── .env.example              # Sample environment variables
├── .gitignore
├── README.md                 # Project overview and quickstart guide
└── requirements.txt          # Root pointer to backend/requirements.txt
```

---

## 2. Backend Domain Architecture (`backend/apps/`)

The backend follows a domain-driven modular structure where each business domain is encapsulated in an isolated Django application within `backend/apps/`:

| Backend App | Domain Responsibilities |
|---|---|
| `accounts` | User authentication, token authorization, roles (Admin, Analyst, Viewer), department profiles. |
| `spatial` | Administrative units (State, District, Taluk, Block, LSGD), GeoJSON spatial boundaries, Shapefile parser. |
| `assessments` | Single-dimension assessments (Hazard, Vulnerability, Exposure), normalization (Min-Max), AHP weighting, scoring. |
| `risk` | Composite risk assessment ($Risk = H \times V \times E$), matrix classification (Very Low to Very High), approval workflows. |
| `queries` | Saved queries, search criteria presets, shareable access tokens. |
| `reports` | Multi-format reporting engine: 220-DPI publication-grade PDFs with embedded GIS choropleth maps, DOCX reports, summary tables. |

---

## 3. Frontend Domain Architecture (`frontend/src/pages/`)

The frontend organizes all application pages into 6 clear domain feature groups mirroring the backend platform capabilities:

```
frontend/src/pages/
├── auth/                     # Authentication & User Onboarding
│   ├── Login/                # User login with role-aware credentials
│   └── Register/             # New user registration & department selection
│
├── dashboard/                # Central Executive Overview & Comparisons
│   ├── Dashboard/            # KPI cards, recent assessments, quick actions, map overview
│   └── Compare/              # Side-by-side comparative analysis of multiple assessments
│
├── assessments/              # Dimension Query Builder & Spatial Analysis
│   ├── NewAssessment/        # Step-by-step query builder, parameter indicators, map picker
│   ├── Processing/           # Asynchronous assessment calculation & progress feedback
│   └── AssessmentResults/    # 3-tab results shell (Score Grid, Choropleth Map, Report Preview)
│
├── risk/                     # Composite Risk Matrix & Approval Workflows
│   ├── RiskBuilder/          # Composite risk form (linking Hazard, Vulnerability, Exposure)
│   └── RiskResults/          # Composite risk scoring, matrix distribution, and executive reports
│
├── data-governance/          # Data Library, Spatial Boundaries, & Audit Log
│   ├── AdminUnits/           # Administrative unit explorer (Districts, Taluks, Blocks, LSGs)
│   ├── DataLibrary/          # GIS raster & vector dataset catalog and upload
│   ├── FloodData/            # Historical flood extent layers, river gauges, precipitation data
│   ├── Libraries/            # Methodology indicator libraries & AHP weight presets
│   ├── Reports/              # Centralized report archive & export manager
│   ├── ReviewQueue/          # Multi-stage reviewer queue (Draft -> In Review -> Approved)
│   └── SavedQueries/         # User saved assessment queries & shareable links
│
└── portal/                   # User Profile, System Configuration, & Help
    ├── Profile/              # User profile, role badges, and assigned district
    ├── Settings/             # System configuration, API keys, and user management
    ├── Notifications/        # System alerts, assessment status updates, review notifications
    └── Help/                 # User guides, methodology documentation, onboarding tour
```

---

## 4. Shared Frontend Components (`frontend/src/components/`)

Shared components reside in `frontend/src/components/` for maximum reusability:

- **Layout**: Application shell, top navigation bar, responsive sidebar, breadcrumbs.
- **Map & Map3D**: Leaflet 2D choropleths, MapLibre 3D digital twins, Kerala district layers.
- **Modals**: Share queries modal, reviewer modal, add administrative unit modal.
- **Toast & ErrorBoundary**: Runtime safety nets and toast feedback notifications.
- **ApprovalPanel**: Action bar for state-transitioning assessment approvals.
- **CommandPalette**: Quick-jump search palette (Cmd/Ctrl + K).
- **OnboardingTour**: Interactive step-by-step onboarding walkthrough.

---

## 5. Path Aliases (`@/`)

To prevent fragile deeply-nested relative imports (`../../..`), TypeScript and Vite are configured with the `@/` path alias:

```typescript
// Example: Importing shared services and components
import { getAssessments } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import ResultsMap from '@/components/Map/ResultsMap';
import type { Assessment } from '@/types';
```
