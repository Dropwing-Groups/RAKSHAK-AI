# RAKSHAK AI

[![CI](https://github.com/dropwing-groups/rakshak-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/dropwing-groups/rakshak-ai/actions/workflows/ci.yml)
![Backend](https://img.shields.io/badge/backend-Django%20REST%20Framework-092E20?logo=django)
![Frontend](https://img.shields.io/badge/frontend-Next.js%2016-000000?logo=nextdotjs)
![AI](https://img.shields.io/badge/AI-YOLOv8%20%7C%20IsolationForest%20%7C%20Bayesian%20Fusion-blueviolet)
![License](https://img.shields.io/badge/license-MIT-green)

RAKSHAK AI is an intelligent surveillance and telemetry platform designed for high-value fleet monitoring. It merges real-time GPS tracking, computer vision (YOLOv8), and multi-agent AI risk analysis to provide preemptive intelligence, actionable insights, and centralized operational command.

## Screenshots

| Command Center | Alert Intelligence Center |
|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Alerts](docs/screenshots/alerts.png) |

| Landing Page | Risk Analysis |
|---|---|
| ![Landing](docs/screenshots/landing.png) | ![Risk Analysis](docs/screenshots/risk-analysis.png) |

<details>
<summary>More screenshots (Fleet, Login)</summary>

| Fleet | Login |
|---|---|
| ![Fleet](docs/screenshots/fleet.png) | ![Login](docs/screenshots/login.png) |

</details>

## System Architecture

The overarching architecture relies on a decoupled client-server model, ensuring the AI inference engine can scale independently of the client-facing telemetry dashboards.

```mermaid
graph TD
    subgraph Frontend [Next.js Web Application]
        UI[Command Center]
        LM[Live Monitoring]
        RA[Risk Analysis]
        AL[Alerts Hub]
    end

    subgraph Backend [Django REST Framework]
        API[API Gateway]
        DB[(PostgreSQL / SQLite)]
    end
    
    subgraph AI Core [Multi-Agent System]
        VA[Vision Agent - YOLOv8]
        BA[Behavior Agent]
        RFA[Risk Fusion Agent]
        EA[Explainability Agent - LLM]
    end

    UI --> |REST / JSON| API
    LM --> |WebSockets / JSON| API
    RA --> |REST / JSON| API
    AL --> |REST / JSON| API
    
    API <--> DB
    API <--> VA
    API <--> BA
    API <--> RFA
    RFA <--> EA
```

## Features Deep-Dive

### 1. Command Center Dashboard
The primary operations hub. It visualizes aggregate fleet health, active consignment status, and system-wide risk through highly optimized, auto-refreshing UI components.
*   **Spatial Mapping:** Integrates dynamic routing and fleet plotting natively within the UI using Leaflet.
*   **Telemetry Grids:** Displays constant variable feeds (speed, engine status, location) mapped against real-time baseline anomalies.
*   **Terminal Interface:** Uses specialized typography and CSS compositing to deliver a high-contrast, distraction-free environment for human operators.

### 2. Live Platform Monitoring
A dedicated pre-journey and mid-journey surveillance interface.
*   **Vision AI Integration:** Processes camera feeds to detect structural anomalies, unauthorized personnel, or package tampering via specific YOLO model bindings.
*   **Staggered Reporting:** Risk reports are generated sequentially as data streams arrive, maintaining operator focus on critical changes rather than static logs.

### 3. Predictive Risk Analysis Engine
A robust Bayesian model interface used for route and cargo planning.
*   **Physical Gauges:** Integrates dynamic vector graphics tied to spring-physics engines to display output scores.
*   **Driver & Route Evaluation:** Weighs historical safety metadata against cargo value and live weather/traffic conditions to output a holistic danger index.
*   **Cascading History:** Archives past predictions allowing operations to review and adjust parameters on the fly.

### 4. Alert Intelligence Center
An automated triage system for incoming anomalies.
*   **Priority Filtering:** Sorts alerts categorically (Critical, High, Medium, Low) and instantly surfaces the highest operational danger.
*   **Explainable AI (XAI):** Rather than outputting binary thresholds, the LLM Explainability Agent synthesizes localized data into a human-readable threat summary.
*   **Recommended Actions:** Instantly proposes predefined security protocols (e.g., "Dispatch Rapid Response", "Notify Convoy Leader") based on the fused penalty vectors of the trigger event.

## Multi-Agent AI Workflow

The backend utilizes an isolated agent structure to prevent processing bottlenecks:
*   **Vision Agent:** Intercepts raw frame data, processing YOLOv8 instances and returning base risk penalties.
*   **Behavior Agent:** Evaluates sequential GPS logs and telemetry against historical norms using isolation forests to flag hijackings or abnormal stops.
*   **Risk Fusion Agent:** The core orchestration brain. It merges spatial risk from routes, vision penalties, and behavior deviations into a finalized scoring metric.
*   **Decision / Explainability Agent:** Translates the raw numeric penalty vectors from the Fusion agent into textual actions broadcasted to the frontend or notification APIs.

## System Workflows & Pipelines

### 1. Vision AI & GPS Triage Event Loop

This sequence illustrates the lifecycle of a physical threat detected by the onboard hardware during an active trip.

```mermaid
sequenceDiagram
    participant Camera as Vehicle Camera
    participant GPS as IoT Telemetry
    participant Agent as Vision / Behavior Agents
    participant Fusion as Risk Fusion Core
    participant XAI as Explainability LLM
    participant UI as Command Center UI

    Camera->>Agent: Stream Live Feed (RTSP/WebRTC)
    GPS->>Agent: Broadcast Telemetry (Speed/Loc)
    loop Every 5 Seconds
        Agent->>Agent: YOLOv8 Inference on Frame
        Agent->>Agent: Spatial Anomaly Check
    end
    Note over Agent: Intruder Detected!
    Agent->>Fusion: Push Penalty Score (+45 Danger)
    Fusion->>Fusion: Aggregate Route & Driver Baseline
    Fusion->>XAI: Final Score (Critical) + Raw Context
    XAI->>XAI: Generate Human-Readable Protocol
    XAI->>UI: Dispatch Socket Event
    UI->>UI: Trigger Visual Alarms & Pulse Styling
```

### 2. Bayesian Pre-Journey Route Analysis

This flowchart maps how logistics coordinators utilize the predictive engine before a truck ever leaves the facility.

```mermaid
graph TD
    Start([Initialize Route]) --> Input[Input Cargo Value & Driver Data]
    Input --> Geo[Request Geospatial Polygons]
    Geo --> Hist{Query Historical DB}
    
    Hist -->|No Past Incidents| M1(Base Risk: Low)
    Hist -->|Past Incidents Found| M2(Elevate Base Risk)
    
    M1 --> Bayesian[Bayesian Weighting Node]
    M2 --> Bayesian
    
    Bayesian -->|High Value Cargo| B1[+30% Risk Factor]
    Bayesian -->|Rookie Driver| B2[+15% Risk Factor]
    
    B1 --> FusionPoint{Risk Fusion Engine}
    B2 --> FusionPoint
    
    FusionPoint -->|Score > 75| Alert[Flag Route for Escort]
    FusionPoint -->|Score < 75| Approve[Clear for Departure]
    
    Alert --> End([Update UI State])
    Approve --> End
```

## Setup & Installation

### 1. Backend Integration (Django + Python AI Core)

The backend hosts the API interfaces, database schemas, and the LangGraph/PyTorch execution environments.

**Prerequisites:** Python 3.10+, standard build tools.

```bash
# Navigate to backend directory
cd backend

# Create isolated execution environment
python -m venv venv
# Windows: venv\Scripts\activate
# Unix/MacOS: source venv/bin/activate

# Install compiled ML dependencies and REST frameworks
pip install -r requirements.txt

# Copy env template and adjust as needed (defaults work out of the box —
# template-based AI explanations, SQLite, SMTP/Twilio suppressed)
cp .env.example .env

# Provision database schemas (Trucks, Trips, GPSLogs, Alerts, JourneyReports)
python manage.py makemigrations
python manage.py migrate

# Initialize the local API server
python manage.py runserver
```

Reference the `backend/API_REFERENCE.md` and `backend/AI_CONTRACT.md` for exact integration parameters. Once active, the API will bind to `http://localhost:8000/`.

**Run the test suite:**

```bash
python manage.py test surveillance
```

### 2. Frontend Application (Next.js)

The frontend leverages React 19, Next.js 16 (Turbopack), and Framer Motion for a fluid, hardware-accelerated monitoring experience.

**Prerequisites:** Node.js 18.17+

```bash
# Navigate to frontend directory
cd frontend

# Copy env template — points the app at the local Django backend
cp .env.example .env.local

# Hydrate node_modules dependencies
npm install

# Initialize the Turbopack compiler
npm run dev
```

Build processes natively optimize images and components. The frontend UI will initialize on `http://localhost:3000/`.

**Lint / build check:**

```bash
npm run lint
npm run build
```

### 3. Run Everything with Docker Compose

For a one-command local stack (Redis + Django backend + Next.js frontend):

```bash
docker compose up --build
```

Backend: `http://localhost:8000/api/` · Frontend: `http://localhost:3000/`.
This uses the same environment defaults as the manual setup above (template
explanations, SQLite, demo mode) — see `docker-compose.yml` to point it at a
managed Postgres/Redis for a real deployment.

## Key API Endpoints

Beyond standard CRUD (`/api/trucks/`, `/api/trips/`, `/api/alerts/`, ...):

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/trips/{id}/gps/` | Ingest a live GPS ping; runs the Route Agent and updates the trip's risk in real time |
| `GET` | `/api/trips/{id}/gps/` | GPS history for a trip |
| `POST` | `/api/trips/{id}/pre-journey-report/` | Generate a saved pre-journey risk report (route + cargo value + driver history) |
| `GET` | `/api/trips/{id}/pre-journey-report/` | Fetch the latest report for a trip |
| `GET` | `/api/route-zones/` | Public GeoJSON of safe corridors / high-risk zones, for the frontend map |
| `POST` | `/api/agents/simulate/` | One-shot demo scenario (used by the dashboard's "Trigger Demo" button) |

Full endpoint reference: `backend/API_REFERENCE.md`. Backend completeness
notes and design rationale: `backend/BACKEND_GAPS.md`.

## Continuous Integration

Every push and pull request runs `.github/workflows/ci.yml`:
Django test suite on the backend, ESLint + `next build` on the frontend.