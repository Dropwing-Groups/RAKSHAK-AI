from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LogisticsCompanyViewSet, ControlAreaContactViewSet,
    TruckViewSet, TripViewSet, GPSLogViewSet, AlertViewSet,
    RouteZonesView,
)
from .agent_views import (
    VisionEventView, FusionRiskView, SimulationView,
    BehaviourAnalysisView, DecisionView, PerceptionView,
    DigitalTwinView, RouteView, RiskFusionView, ExplainabilityView,
)
from .auth_views import (
    LoginView, LogoutView, MeView, ChangePasswordView, RegisterView,
    CompanyRegistrationView
)
from .admin_views import (
    AdminDashboardView, AdminCompanyListView, AdminUserListView,
    AdminUserDetailView, AdminAlertListView
)

router = DefaultRouter()
router.register(r'companies',     LogisticsCompanyViewSet,   basename='company')
router.register(r'contacts',      ControlAreaContactViewSet, basename='contact')
router.register(r'trucks',        TruckViewSet,              basename='truck')
router.register(r'trips',         TripViewSet,               basename='trip')
router.register(r'gps-logs',      GPSLogViewSet,             basename='gpslog')
router.register(r'alerts',        AlertViewSet,              basename='alert')

urlpatterns = [
    path('', include(router.urls)),

    # ---------------------------------------------------------
    # Auth Endpoints
    # ---------------------------------------------------------
    path('auth/login/',          LoginView.as_view(),          name='auth-login'),
    path('auth/logout/',         LogoutView.as_view(),         name='auth-logout'),
    path('auth/me/',             MeView.as_view(),             name='auth-me'),
    path('auth/change-password/',ChangePasswordView.as_view(), name='auth-change-password'),
    path('auth/register/',       RegisterView.as_view(),       name='auth-register'),   # Admin only
    path('auth/register-company/',CompanyRegistrationView.as_view(), name='auth-register-company'), # Public


    # ---------------------------------------------------------
    # Admin Panel Endpoints (Requires 'admin' role)
    # ---------------------------------------------------------
    path('admin/dashboard/',     AdminDashboardView.as_view(),   name='admin-dashboard'),
    path('admin/companies/',     AdminCompanyListView.as_view(), name='admin-companies'),
    path('admin/users/',         AdminUserListView.as_view(),    name='admin-users'),
    path('admin/users/<int:pk>/',AdminUserDetailView.as_view(),  name='admin-user-detail'),
    path('admin/alerts/',        AdminAlertListView.as_view(),   name='admin-alerts'),

    # ---------------------------------------------------------
    # Agent Endpoints
    # ---------------------------------------------------------
    path('agents/vision-event/',        VisionEventView.as_view(),        name='vision_event'),
    path('agents/fusion-risk/',         FusionRiskView.as_view(),         name='fusion_risk'),
    path('agents/simulate/',            SimulationView.as_view(),         name='simulate'),
    path('agents/behaviour-analysis/',  BehaviourAnalysisView.as_view(),  name='behaviour_analysis'),
    path('agents/decision/',            DecisionView.as_view(),            name='decision'),
    path('agents/perception/',          PerceptionView.as_view(),          name='perception'),
    path('agents/digital-twin/',        DigitalTwinView.as_view(),        name='digital_twin'),
    path('agents/route/',               RouteView.as_view(),               name='route'),
    path('agents/risk-fusion/',         RiskFusionView.as_view(),         name='risk_fusion'),
    path('agents/explain/',             ExplainabilityView.as_view(),     name='explain'),

    # ---------------------------------------------------------
    # Public map data
    # ---------------------------------------------------------
    path('route-zones/',                RouteZonesView.as_view(),         name='route-zones'),
]
