# RAKSHAK AI — Backend Gaps & Recommendations

> Snapshot of backend completeness vs. the original spec. Updated after closing
> the hackathon-critical gaps (GPS ingestion, route-zone map data, XAI wiring,
> pre-journey reports). Historical context is kept below for anyone auditing
> what changed and why.

---

## ✅ WHAT IS IMPLEMENTED

| Module (from spec) | Backend Status |
|---|---|
| Theft Prediction Engine | ✅ `risk_fusion_agent.py` — weighted + Bayesian fusion. `risk_model.pkl` trained |
| Vision AI Detection (YOLOv8) | ✅ `perception_agent.py` — YOLO + DeepSORT, REST bridge via `/api/agents/perception/` |
| Behavior Intelligence Engine | ✅ `behavior_agent.py` — IsolationForest, loitering/crowd detection, `behavior_model.pkl` |
| Digital Twin Engine | ✅ `digital_twin_agent.py` — IoT telemetry, deviation detection, Redis pub/sub |
| Explainable Risk Engine | ✅ `explainability_agent.py` — rule-based / OpenAI / Ollama explanation generation |
| Route Risk Intelligence | ✅ `route_agent.py` — Shapely geofencing, safe corridors, risk zones, `route_model.pkl` |
| Decision Engine | ✅ `decision_agent.py` — Rules R001/R002/R003, cooldown, Redis logging |
| Orchestrator | ✅ `orchestrator.py` — ties agents together |
| Django Models | ✅ `LogisticsCompany`, `Truck`, `Trip`, `GPSLog`, `Alert`, `JourneyReport`, `ControlAreaContact`, `CompanyUser` |
| REST API | ✅ All agent views bridged via DRF: perception, behaviour, decision, digital-twin, route, risk-fusion, explain |
| Notifications | ✅ `notification_service.py` — email + SMS (Twilio) to control room contacts **and** the truck driver |
| Auth | ✅ Token auth, role-based (admin / company_user / viewer) |
| Demo Simulation | ✅ `/api/agents/simulate/` endpoint injects sample alerts for demo |
| **Pre-Journey Risk Report** | ✅ `POST/GET /api/trips/{id}/pre-journey-report/` — `JourneyReport` model, route + cargo-value + driver-history scoring, saved recommendations |
| **Real-time GPS ingestion** | ✅ `POST/GET /api/trips/{id}/gps/` — persists `GPSLog`, runs the Route Agent live, updates `Trip.current_calculated_risk` |
| **Route zone map data** | ✅ `GET /api/route-zones/` — public GeoJSON `FeatureCollection` of safe corridors + high-risk zones for the frontend Leaflet map |
| **XAI wired into every alert** | ✅ `AlertViewSet.perform_create` auto-generates `ai_explanation` via the Explainability Agent when not supplied |
| Test suite | ✅ `surveillance/tests.py` — Django `APITestCase` coverage for auth, GPS ingestion, pre-journey reports, alert creation, route-zones |
| CI | ✅ `.github/workflows/ci.yml` — backend tests + frontend lint/build on every push/PR |

---

## 🏗️ NICE-TO-HAVE (Future)

- `GET /api/trucks/{id}/digital-twin-profile/` — expose the Digital Twin's learned baseline for a truck
- Batch GPS ingest endpoint for simulating historical replay
- WebSocket / SSE push for the dashboard (currently 30s polling) — Django Channels
- Rate limiting on agent views to prevent overload
- Admin panel scenario builder for demos without needing the API

## 🧹 Removed dead code

`llm_service.py` and `supabase_service.py` were empty (0 bytes) and never
imported anywhere — removed rather than left half-implemented. The
Explainability Agent's OpenAI/Ollama/template logic already lives in
`surveillance/agents/explainability_agent.py`; Supabase was never wired into
`settings.py` (the project uses `DATABASE_URL` via `dj-database-url`, SQLite
by default).
