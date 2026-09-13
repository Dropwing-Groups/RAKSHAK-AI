"""
RAKSHAK AI — Backend Test Suite

Covers the core CRUD/auth flows plus the newly added endpoints:
  - Company registration + login
  - Truck / Trip creation
  - GPS ingestion (POST /api/trips/{id}/gps/) and live route risk update
  - Alert creation (auto notification dispatch + auto AI explanation)
  - Pre-journey risk report (POST/GET /api/trips/{id}/pre-journey-report/)
  - Public route-zones GeoJSON endpoint

Run with:
    python manage.py test surveillance
"""
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status

from .models import LogisticsCompany, CompanyUser, Truck, Trip, Alert, JourneyReport


class AuthFlowTests(APITestCase):
    def test_register_company_then_login(self):
        resp = self.client.post('/api/auth/register-company/', {
            "company_name": "Test Logistics",
            "company_city": "Delhi",
            "first_name": "Test",
            "last_name": "Admin",
            "email": "admin@testlogistics.example",
            "username": "testadmin",
            "password": "StrongPass123!",
        }, format='json')
        self.assertIn(resp.status_code, (200, 201), resp.content)
        self.assertIn('token', resp.data)

        login_resp = self.client.post('/api/auth/login/', {
            "username": "testadmin",
            "password": "StrongPass123!",
        }, format='json')
        self.assertEqual(login_resp.status_code, 200)
        self.assertIn('token', login_resp.data)

    def test_login_rejects_bad_credentials(self):
        resp = self.client.post('/api/auth/login/', {
            "username": "nobody",
            "password": "wrong",
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class AuthenticatedAPITestCase(APITestCase):
    """Base class that sets up a logged-in company_user with one truck + trip."""

    def setUp(self):
        self.company = LogisticsCompany.objects.create(
            name="Rakshak Test Co", city="Mumbai",
            control_email="control@rakshaktest.example",
        )
        self.user = User.objects.create_user(username="fleetop", password="StrongPass123!")
        CompanyUser.objects.create(user=self.user, company=self.company, role="company_user")

        resp = self.client.post('/api/auth/login/', {
            "username": "fleetop", "password": "StrongPass123!",
        }, format='json')
        self.token = resp.data['token']
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token}')

        self.truck = Truck.objects.create(
            company=self.company, driver_name="Ravi Kumar", driver_phone="+911234567890",
            license_plate="DL-01-AB-1234", cargo_type="Electronics", cargo_value=750000,
        )
        self.trip = Trip.objects.create(
            truck=self.truck,
            start_location_name="Delhi", destination_name="Jaipur",
            start_time=timezone.now(),
        )


class TripAndGPSTests(AuthenticatedAPITestCase):
    def test_gps_ingestion_creates_log_and_updates_risk(self):
        resp = self.client.post(f'/api/trips/{self.trip.trip_id}/gps/', {
            "latitude": 28.61, "longitude": 77.21, "speed_kmh": 60, "heading": 90,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        self.assertIn('gps_log', resp.data)
        self.assertEqual(self.trip.gps_logs.count(), 1)

        self.trip.refresh_from_db()
        # current_calculated_risk should be a valid 0-100 float after the route check
        self.assertGreaterEqual(self.trip.current_calculated_risk, 0.0)

    def test_gps_get_returns_history(self):
        self.client.post(f'/api/trips/{self.trip.trip_id}/gps/', {
            "latitude": 28.61, "longitude": 77.21,
        }, format='json')
        resp = self.client.get(f'/api/trips/{self.trip.trip_id}/gps/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)

    def test_gps_rejects_invalid_latitude(self):
        resp = self.client.post(f'/api/trips/{self.trip.trip_id}/gps/', {
            "latitude": 999, "longitude": 77.21,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class PreJourneyReportTests(AuthenticatedAPITestCase):
    def test_generate_and_fetch_report(self):
        resp = self.client.post(f'/api/trips/{self.trip.trip_id}/pre-journey-report/')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        self.assertIn('risk_level', resp.data)
        self.assertIn('recommendations', resp.data)
        self.assertGreaterEqual(JourneyReport.objects.filter(trip=self.trip).count(), 1)

        get_resp = self.client.get(f'/api/trips/{self.trip.trip_id}/pre-journey-report/')
        self.assertEqual(get_resp.status_code, 200)
        self.assertEqual(get_resp.data['report_id'], resp.data['report_id'])

    def test_high_value_cargo_raises_risk_factor(self):
        # cargo_value on the truck is 750000 -> should apply the top cargo_value_factor
        resp = self.client.post(f'/api/trips/{self.trip.trip_id}/pre-journey-report/')
        self.assertEqual(resp.data['cargo_value_factor'], 0.30)

    def test_report_without_auth_is_rejected(self):
        self.client.credentials()  # clear auth
        resp = self.client.post(f'/api/trips/{self.trip.trip_id}/pre-journey-report/')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class AlertCreationTests(AuthenticatedAPITestCase):
    def test_alert_auto_generates_explanation(self):
        resp = self.client.post('/api/alerts/', {
            "trip": self.trip.trip_id,
            "type": "Behavior",
            "severity": "High",
            "risk_score": 72.5,
            "description": "Unscheduled stop for 20 minutes.",
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        alert = Alert.objects.get(alert_id=resp.data['alert_id'])
        self.assertTrue(alert.ai_explanation, "Expected ai_explanation to be auto-populated")

    def test_resolve_alert(self):
        alert = Alert.objects.create(
            trip=self.trip, type='System', severity='Low', risk_score=10.0,
            description="Test alert",
        )
        resp = self.client.post(f'/api/alerts/{alert.alert_id}/resolve/')
        self.assertEqual(resp.status_code, 200)
        alert.refresh_from_db()
        self.assertTrue(alert.resolved)


class RouteZonesPublicEndpointTests(TestCase):
    def test_route_zones_is_public_geojson(self):
        client = self.client_class()
        resp = client.get('/api/route-zones/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['type'], 'FeatureCollection')
        self.assertGreater(len(data['features']), 0)
        zone_types = {f['properties']['zone_type'] for f in data['features']}
        self.assertTrue({'safe_corridor', 'high_risk_zone'}.issubset(zone_types))
