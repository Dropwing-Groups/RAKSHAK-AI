from rest_framework import viewsets, status, views
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .models import LogisticsCompany, ControlAreaContact, Truck, Trip, GPSLog, Alert, JourneyReport
from .serializers import (
    LogisticsCompanySerializer, ControlAreaContactSerializer,
    TruckSerializer, TripSerializer, GPSLogSerializer, AlertSerializer,
    JourneyReportSerializer,
)
from .permissions import IsCompanyUserOrAdmin, get_company_filter


# ============================================================
# Logistics Company
# ============================================================

class LogisticsCompanyViewSet(viewsets.ModelViewSet):
    """CRUD for logistics companies. Includes nested contacts and computed truck/trip counts."""
    serializer_class = LogisticsCompanySerializer
    permission_classes = [IsCompanyUserOrAdmin]

    def get_queryset(self):
        qs = LogisticsCompany.objects.prefetch_related('contacts', 'trucks').all()
        company = get_company_filter(self.request.user)
        if company:
            qs = qs.filter(company_id=company.company_id)
            
        active = self.request.query_params.get('active')
        if active is not None:
            qs = qs.filter(active=active.lower() == 'true')
        city = self.request.query_params.get('city')
        if city:
            qs = qs.filter(city__icontains=city)
        return qs

    @action(detail=True, methods=['get'])
    def trucks(self, request, pk=None):
        company = self.get_object()
        trucks = company.trucks.all()
        return Response(TruckSerializer(trucks, many=True).data)

    @action(detail=True, methods=['get'])
    def alerts(self, request, pk=None):
        company = self.get_object()
        truck_ids = company.trucks.values_list('truck_id', flat=True)
        trip_ids  = Trip.objects.filter(truck__truck_id__in=truck_ids).values_list('trip_id', flat=True)
        alerts    = Alert.objects.filter(trip__trip_id__in=trip_ids).order_by('-timestamp')[:50]
        return Response(AlertSerializer(alerts, many=True).data)

    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        company  = self.get_object()
        trucks   = company.trucks.all()
        truck_ids = trucks.values_list('truck_id', flat=True)
        trips    = Trip.objects.filter(truck__truck_id__in=truck_ids)
        alerts   = Alert.objects.filter(trip__in=trips)

        return Response({
            "company": company.name,
            "total_trucks":   trucks.count(),
            "active_trucks":  trucks.filter(active=True).count(),
            "total_trips":    trips.count(),
            "active_trips":   trips.filter(status__in=['Scheduled', 'In-Transit']).count(),
            "alert_trips":    trips.filter(status='Alert').count(),
            "total_alerts":   alerts.count(),
            "unresolved":     alerts.filter(resolved=False).count(),
            "critical_alerts": alerts.filter(severity='Critical', resolved=False).count(),
        })


# ============================================================
# Control Area Contact
# ============================================================

class ControlAreaContactViewSet(viewsets.ModelViewSet):
    serializer_class = ControlAreaContactSerializer
    permission_classes = [IsCompanyUserOrAdmin]

    def get_queryset(self):
        qs = ControlAreaContact.objects.select_related('company').all()
        company = get_company_filter(self.request.user)
        if company:
            qs = qs.filter(company=company)
            
        company_id = self.request.query_params.get('company_id')
        if company_id:
            qs = qs.filter(company__company_id=company_id)
        active = self.request.query_params.get('active')
        if active is not None:
            qs = qs.filter(active=active.lower() == 'true')
        return qs


# ============================================================
# Truck
# ============================================================

class TruckViewSet(viewsets.ModelViewSet):
    serializer_class = TruckSerializer
    permission_classes = [IsCompanyUserOrAdmin]

    def get_queryset(self):
        qs = Truck.objects.select_related('company').all()
        company_filter = get_company_filter(self.request.user)
        if company_filter:
            qs = qs.filter(company=company_filter)
            
        company_id = self.request.query_params.get('company_id')
        if company_id:
            qs = qs.filter(company__company_id=company_id)
        active = self.request.query_params.get('active')
        if active is not None:
            qs = qs.filter(active=active.lower() == 'true')
        return qs


# ============================================================
# Trip
# ============================================================

class TripViewSet(viewsets.ModelViewSet):
    serializer_class = TripSerializer
    permission_classes = [IsCompanyUserOrAdmin]

    def get_queryset(self):
        qs = Trip.objects.select_related('truck__company').all()
        company_filter = get_company_filter(self.request.user)
        if company_filter:
            qs = qs.filter(truck__company=company_filter)
            
        company_id = self.request.query_params.get('company_id')
        if company_id:
            qs = qs.filter(truck__company__company_id=company_id)
        truck_id = self.request.query_params.get('truck_id')
        if truck_id:
            qs = qs.filter(truck__truck_id=truck_id)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        from .services.map_service import GeoSpatialService
        trip = serializer.save()
        start_coords = GeoSpatialService.get_coordinates(trip.start_location_name)
        dest_coords  = GeoSpatialService.get_coordinates(trip.destination_name)
        trip.start_location_coords = start_coords
        trip.destination_coords    = dest_coords
        route_info = GeoSpatialService.calculate_route(start_coords, dest_coords)
        distance = route_info.get("distance_meters", 100000)
        baseline_risk = GeoSpatialService.calculate_baseline_risk(
            distance, trip.start_location_name, trip.destination_name
        )
        trip.baseline_route_risk     = baseline_risk
        trip.current_calculated_risk = baseline_risk
        trip.save()

    @action(detail=True, methods=['get'])
    def dashboard(self, request, pk=None):
        trip        = self.get_object()
        latest_gps  = trip.gps_logs.order_by('-timestamp').first()
        recent_alerts = trip.alerts.order_by('-timestamp')[:5]
        current_risk = min(100, sum(a.risk_score for a in recent_alerts) if recent_alerts else 0)
        return Response({
            'trip_id':           trip.trip_id,
            'status':            trip.status,
            'current_risk_score': current_risk,
            'latest_location':   GPSLogSerializer(latest_gps).data if latest_gps else None,
            'recent_alerts':     AlertSerializer(recent_alerts, many=True).data,
        })

    @action(detail=True, methods=['post', 'get'])
    def gps(self, request, pk=None):
        """
        POST /api/trips/{id}/gps/  — real-time GPS ingestion for an active trip.
        Body: { "latitude": .., "longitude": .., "speed_kmh": .., "heading": ..,
                "engine_status": true, "door_sealed": true }

        Saves the GPSLog, then runs the Route Agent against the new coordinates
        so Trip.current_calculated_risk reflects the truck's live position
        (safe corridor / high-risk zone / night-hour multiplier) without
        needing a separate manual call to /api/agents/route/.

        GET /api/trips/{id}/gps/  — list the trip's GPS log history (most recent first).
        """
        trip = self.get_object()

        if request.method == 'GET':
            logs = trip.gps_logs.order_by('-timestamp')[:200]
            return Response(GPSLogSerializer(logs, many=True).data)

        data = dict(request.data)
        data['trip'] = trip.trip_id
        serializer = GPSLogSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        gps_log = serializer.save(trip=trip)

        route_info = None
        try:
            from .agent_views import _get_route_agent, run_async
            from shapely.geometry import Point

            agent = _get_route_agent()
            point = Point(gps_log.longitude, gps_log.latitude)
            hour = timezone.localtime().hour
            in_safe, deviation_km, corridor_name = agent._check_safe_corridor(point)
            in_risk, risk_zone_name = agent._check_risk_zones(point)
            multiplier = agent._compute_time_multiplier(hour)
            route_risk = agent._compute_route_risk_score(in_safe, deviation_km, in_risk, multiplier)
            route_risk_pct = round(route_risk * 100, 2)

            route_info = {
                "in_safe_corridor": in_safe,
                "nearest_corridor": corridor_name,
                "in_high_risk_zone": in_risk,
                "high_risk_zone_name": risk_zone_name,
                "route_risk_score": route_risk,
            }

            # Blend the live route risk into the trip's running risk figure
            # rather than overwriting it outright — the max of the two keeps
            # any active alert-driven escalation intact.
            trip.current_calculated_risk = max(trip.current_calculated_risk, route_risk_pct)
            if route_risk_pct >= 70 and trip.status not in ('Alert', 'Completed'):
                trip.status = 'Alert'
            trip.save(update_fields=['current_calculated_risk', 'status'])

            if not in_safe or in_risk:
                Alert.objects.create(
                    trip=trip, type='Route',
                    severity='Critical' if route_risk_pct >= 80 else 'High',
                    risk_score=route_risk_pct,
                    description=(
                        f"Route Agent: {'Off safe corridor. ' if not in_safe else ''}"
                        f"{f'In high-risk zone: {risk_zone_name}.' if in_risk else ''}"
                    ),
                )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"GPS ingestion route-check skipped: {e}")

        return Response({
            "gps_log": GPSLogSerializer(gps_log).data,
            "route_check": route_info,
            "trip_current_risk": trip.current_calculated_risk,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post', 'get'], url_path='pre-journey-report')
    def pre_journey_report(self, request, pk=None):
        """
        POST /api/trips/{id}/pre-journey-report/ — generate and persist a
        full pre-journey risk report: route agent geofence check against the
        trip's start location, cargo-value weighting, and driver history
        (past unresolved/critical alerts), producing a recommendation list.

        GET /api/trips/{id}/pre-journey-report/ — return the most recent report.
        """
        trip = self.get_object()

        if request.method == 'GET':
            report = trip.journey_reports.order_by('-generated_at').first()
            if not report:
                return Response({"error": "No pre-journey report generated yet."},
                                 status=status.HTTP_404_NOT_FOUND)
            return Response(JourneyReportSerializer(report).data)

        from .agent_views import _get_route_agent
        from .services.map_service import GeoSpatialService
        from shapely.geometry import Point

        # Resolve the trip's starting coordinates (fallback to city lookup)
        coords = trip.start_location_coords or GeoSpatialService.get_coordinates(trip.start_location_name)
        try:
            lat_str, lon_str = coords.split(',')
            lat, lon = float(lat_str), float(lon_str)
        except Exception:
            lat, lon = 28.6139, 77.2090  # Delhi fallback

        agent = _get_route_agent()
        point = Point(lon, lat)
        hour = timezone.localtime().hour
        in_safe, deviation_km, corridor_name = agent._check_safe_corridor(point)
        in_risk, risk_zone_name = agent._check_risk_zones(point)
        multiplier = agent._compute_time_multiplier(hour)
        route_risk = agent._compute_route_risk_score(in_safe, deviation_km, in_risk, multiplier)

        # Cargo value factor: higher-value cargo raises risk (spec: +30% for high value)
        cargo_value = float(trip.truck.cargo_value or 0)
        cargo_value_factor = 0.30 if cargo_value >= 500000 else (0.15 if cargo_value >= 100000 else 0.0)

        # Driver history factor: past Critical/High alerts on this driver's truck
        past_alerts = Alert.objects.filter(
            trip__truck=trip.truck, severity__in=['Critical', 'High']
        ).exclude(trip=trip).count()
        driver_history_factor = min(0.15 * past_alerts, 0.30)

        baseline = route_risk + cargo_value_factor + driver_history_factor
        composite = min(round(baseline * 100, 2), 100.0)
        risk_level = (
            'CRITICAL' if composite >= 80 else
            'HIGH' if composite >= 60 else
            'MEDIUM' if composite >= 35 else 'LOW'
        )

        recommendations = []
        if in_risk:
            recommendations.append(f"Avoid or add escort through high-risk zone: {risk_zone_name}.")
        if not in_safe:
            recommendations.append(f"Reroute onto a monitored safe corridor (nearest: {corridor_name}).")
        if cargo_value_factor > 0:
            recommendations.append("High-value cargo — assign an armed/verified escort for this trip.")
        if driver_history_factor > 0:
            recommendations.append("Driver's truck has prior flagged incidents — recommend co-driver or route review.")
        if multiplier > 1.0:
            recommendations.append("Departure falls in night hours — night-time risk multiplier applied.")
        if not recommendations:
            recommendations.append("No elevated risk factors detected. Cleared for standard departure.")

        summary = (
            f"Pre-journey assessment for {trip.start_location_name} → {trip.destination_name}: "
            f"{risk_level} risk ({composite:.1f}/100). "
            f"{'Route passes through a flagged zone. ' if in_risk else ''}"
            f"{'Cargo value elevates risk. ' if cargo_value_factor else ''}"
            f"{'Driver has a prior incident history. ' if driver_history_factor else ''}"
        ).strip()

        report = JourneyReport.objects.create(
            trip=trip,
            baseline_route_risk=trip.baseline_route_risk,
            route_risk_score=route_risk,
            in_safe_corridor=in_safe,
            nearest_corridor_name=corridor_name,
            in_high_risk_zone=in_risk,
            high_risk_zone_name=risk_zone_name,
            cargo_value_factor=cargo_value_factor,
            driver_history_factor=driver_history_factor,
            composite_risk_score=composite,
            risk_level=risk_level,
            recommendations=recommendations,
            summary=summary,
        )

        return Response(JourneyReportSerializer(report).data, status=status.HTTP_201_CREATED)


# ============================================================
# GPS Log
# ============================================================

class GPSLogViewSet(viewsets.ModelViewSet):
    serializer_class = GPSLogSerializer
    permission_classes = [IsCompanyUserOrAdmin]

    def get_queryset(self):
        qs = GPSLog.objects.all()
        company_filter = get_company_filter(self.request.user)
        if company_filter:
            qs = qs.filter(trip__truck__company=company_filter)
            
        trip_id = self.request.query_params.get('trip_id')
        if trip_id:
            qs = qs.filter(trip__trip_id=trip_id)
        return qs


# ============================================================
# Alert
# ============================================================

class AlertViewSet(viewsets.ModelViewSet):
    serializer_class = AlertSerializer
    permission_classes = [IsCompanyUserOrAdmin]

    def get_queryset(self):
        qs = Alert.objects.select_related('trip__truck__company').all()
        company_filter = get_company_filter(self.request.user)
        if company_filter:
            qs = qs.filter(trip__truck__company=company_filter)
            
        trip_id = self.request.query_params.get('trip_id')
        if trip_id:
            qs = qs.filter(trip__trip_id=trip_id)
        company_id = self.request.query_params.get('company_id')
        if company_id:
            qs = qs.filter(trip__truck__company__company_id=company_id)
        severity = self.request.query_params.get('severity')
        if severity:
            qs = qs.filter(severity=severity)
        resolved = self.request.query_params.get('resolved')
        if resolved is not None:
            qs = qs.filter(resolved=resolved.lower() == 'true')
        return qs

    def perform_create(self, serializer):
        from .notification_service import dispatch_alert
        alert = serializer.save()
        trip  = alert.trip
        truck = trip.truck
        company = truck.company

        # Auto-populate ai_explanation if the caller didn't already supply one,
        # so every Alert shown on the frontend carries a human-readable XAI
        # summary (template-based by default; OpenAI/Ollama if LLM_PROVIDER is set).
        if not alert.ai_explanation:
            try:
                from .agents.explainability_agent import ExplainabilityAgent
                from .agent_views import run_async

                explain_agent = ExplainabilityAgent()
                risk_payload = {
                    "truck_id": str(truck.truck_id),
                    "risk_level": alert.severity.upper(),
                    "composite_risk_score": alert.risk_score / 100.0,
                    "confidence": 0.8,
                    "fusion_method": "auto_on_create",
                }
                decision_payload = {
                    "rule_name": f"{alert.type}_ALERT",
                    "actions_taken": ["log"],
                }
                explanation_text, _model = run_async(
                    explain_agent._generate_explanation(decision_payload, risk_payload)
                )
                alert.ai_explanation = explanation_text
                alert.save(update_fields=['ai_explanation'])
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Auto-explanation skipped: {e}")

        severity_rank = {'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4}
        if severity_rank.get(alert.severity, 0) >= 2:
            try:
                dispatch_alert(alert, trip, truck, company)
                alert.email_sent  = True
                alert.sms_sent    = True
                alert.notified_at = timezone.now()
                alert.save(update_fields=['email_sent', 'sms_sent', 'notified_at'])
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Notification dispatch failed: {e}")

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        alert = self.get_object()
        alert.resolved = True
        alert.save(update_fields=['resolved'])
        return Response({'status': 'resolved', 'alert_id': alert.alert_id})

    @action(detail=True, methods=['post'])
    def resend_notifications(self, request, pk=None):
        from .notification_service import dispatch_alert
        alert = self.get_object()
        trip  = alert.trip
        truck = trip.truck
        try:
            dispatch_alert(alert, trip, truck, truck.company)
            alert.notified_at = timezone.now()
            alert.save(update_fields=['notified_at'])
            return Response({'status': 'notifications_sent'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================================
# Route Zones (Public GeoJSON for the frontend Leaflet map)
# ============================================================

class RouteZonesView(views.APIView):
    """
    GET /api/route-zones/

    Returns the Route Agent's safe-corridor and high-risk-zone polygons as a
    GeoJSON FeatureCollection so the frontend Leaflet map can render colored
    overlays (green = safe corridor, red = high-risk zone) without needing
    an authenticated agent call for every render.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        from .agent_views import _get_route_agent

        agent = _get_route_agent()
        features = []

        for corridor in agent.safe_corridors:
            polygon = corridor["polygon"]
            features.append({
                "type": "Feature",
                "properties": {
                    "zone_type": "safe_corridor",
                    "name": corridor["name"],
                    "color": "#22c55e",
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [list(polygon.exterior.coords)],
                },
            })

        for zone in agent.risk_zones:
            polygon = zone["polygon"]
            features.append({
                "type": "Feature",
                "properties": {
                    "zone_type": "high_risk_zone",
                    "name": zone["name"],
                    "color": "#ef4444",
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [list(polygon.exterior.coords)],
                },
            })

        return Response({
            "type": "FeatureCollection",
            "features": features,
        })
