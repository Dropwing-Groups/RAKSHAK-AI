from django.db import models
from django.contrib.auth.models import User
import uuid


# ============================================================
# Logistics Company & Control Area
# ============================================================

class LogisticsCompany(models.Model):
    company_id    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name          = models.CharField(max_length=255, unique=True)
    registration_number = models.CharField(max_length=100, blank=True, null=True)
    address       = models.TextField(blank=True, null=True)
    city          = models.CharField(max_length=100, blank=True, null=True)
    state         = models.CharField(max_length=100, blank=True, null=True)
    country       = models.CharField(max_length=100, default="India")
    website       = models.URLField(blank=True, null=True)

    # Primary control area contacts (used by notification service)
    control_email = models.EmailField(blank=True, null=True, help_text="Main control room email")
    control_phone = models.CharField(max_length=20, blank=True, null=True,
                                     help_text="Main control room phone (Twilio SMS)")

    # Service agreement
    active        = models.BooleanField(default=True)
    joined_date   = models.DateField(auto_now_add=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Logistics Company"
        verbose_name_plural = "Logistics Companies"
        ordering = ['name']

    def __str__(self):
        return self.name

    @property
    def active_trucks(self):
        return self.trucks.filter(active=True).count()

    @property
    def active_trips(self):
        # Count Trip records directly (avoids duplicate counting via reverse relation)
        from django.apps import apps
        Trip = apps.get_model('surveillance', 'Trip')
        return Trip.objects.filter(
            truck__company=self,
            status__in=['Scheduled', 'In-Transit']
        ).count()


class ControlAreaContact(models.Model):
    """Individual contacts within a logistics company's control room."""
    contact_id   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company      = models.ForeignKey(LogisticsCompany, on_delete=models.CASCADE,
                                     related_name='contacts')
    name         = models.CharField(max_length=255)
    role         = models.CharField(max_length=100, blank=True, null=True,
                                    help_text="e.g. Fleet Manager, Security Officer")
    email        = models.EmailField(blank=True, null=True)
    phone        = models.CharField(max_length=20, blank=True, null=True)
    notify_email = models.BooleanField(default=True)
    notify_sms   = models.BooleanField(default=True)
    # Minimum severity to trigger notification: Low / Medium / High / Critical
    min_severity = models.CharField(max_length=20, default='Medium',
                                    choices=[('Low','Low'),('Medium','Medium'),
                                             ('High','High'),('Critical','Critical')])
    active       = models.BooleanField(default=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.role}) @ {self.company.name}"


# ============================================================
# Company User (Authentication & Role)
# ============================================================

class CompanyUser(models.Model):
    """
    Links a Django User to a LogisticsCompany with a role.
    One profile per Django User account.

    Roles:
      admin        → full access to all companies (company=null)
      company_user → full CRUD scoped to own company
      viewer       → read-only scoped to own company
    """
    ROLE_CHOICES = [
        ('admin',        'Platform Admin'),
        ('company_user', 'Company User'),
        ('viewer',       'Read-Only Viewer'),
    ]

    user      = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='company_profile'
    )
    company   = models.ForeignKey(
        LogisticsCompany,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='users',
        help_text="Null for platform admin accounts",
    )
    role      = models.CharField(max_length=20, choices=ROLE_CHOICES, default='company_user')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['user__username']
        verbose_name = "Company User"

    def __str__(self):
        company_name = self.company.name if self.company else "Platform Admin"
        return f"{self.user.username} [{self.role}] @ {company_name}"

    @property
    def full_name(self):
        return self.user.get_full_name() or self.user.username

    @property
    def email(self):
        return self.user.email


# ============================================================
# Truck
# ============================================================

class Truck(models.Model):
    truck_id       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company        = models.ForeignKey(LogisticsCompany, on_delete=models.SET_NULL,
                                       null=True, blank=True, related_name='trucks')
    driver_name    = models.CharField(max_length=255)
    driver_phone   = models.CharField(max_length=50, blank=True, null=True)
    driver_email   = models.EmailField(blank=True, null=True, help_text="Driver email for alert notifications")
    license_plate  = models.CharField(max_length=50, unique=True, null=True)
    cargo_type     = models.CharField(max_length=255)
    cargo_value    = models.DecimalField(max_digits=12, decimal_places=2)
    iot_sensor_id  = models.CharField(max_length=100, blank=True, null=True)
    vehicle_make_model = models.CharField(max_length=255, blank=True, null=True)
    active         = models.BooleanField(default=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['license_plate']

    def __str__(self):
        co = f" [{self.company.name}]" if self.company else ""
        return f"{self.license_plate or 'Unknown'} - {self.driver_name}{co}"


# ============================================================
# Trip
# ============================================================

class Trip(models.Model):
    trip_id       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    truck         = models.ForeignKey(Truck, on_delete=models.CASCADE, related_name='trips')
    start_location_name   = models.CharField(max_length=255)
    start_location_coords = models.CharField(max_length=255, blank=True, null=True)
    destination_name      = models.CharField(max_length=255)
    destination_coords    = models.CharField(max_length=255, blank=True, null=True)
    start_time            = models.DateTimeField()
    estimated_arrival     = models.DateTimeField(null=True, blank=True)

    baseline_route_risk     = models.FloatField(default=0.0)
    current_calculated_risk = models.FloatField(default=0.0)

    status_choices = [
        ('Scheduled',  'Scheduled'),
        ('In-Transit', 'In-Transit'),
        ('Completed',  'Completed'),
        ('Alert',      'Alert'),
        ('Cancelled',  'Cancelled'),
    ]
    status = models.CharField(max_length=20, choices=status_choices, default='Scheduled')

    class Meta:
        ordering = ['-start_time']

    def __str__(self):
        return f"Trip {self.trip_id} | {self.start_location_name} → {self.destination_name}"


# ============================================================
# GPS Log
# ============================================================

class GPSLog(models.Model):
    log_id      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip        = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='gps_logs')
    latitude    = models.FloatField()
    longitude   = models.FloatField()
    speed_kmh   = models.FloatField(default=0.0)
    heading     = models.FloatField(default=0.0)
    engine_status = models.BooleanField(default=True)
    door_sealed = models.BooleanField(default=True, null=True)
    timestamp   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"GPS log for Trip {self.trip.trip_id} @ {self.timestamp}"


# ============================================================
# Alert
# ============================================================

class Alert(models.Model):
    alert_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip     = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='alerts')

    alert_types = [
        ('Vision',    'Vision Detection'),
        ('Behavior',  'Suspicious Behavior'),
        ('Route',     'Route Deviation'),
        ('System',    'System Alert'),
        ('Fusion',    'High Risk Fusion Alert'),
        ('IoT',       'IoT Sensor Anomaly'),
    ]
    type = models.CharField(max_length=20, choices=alert_types)

    severity_choices = [
        ('Low',      'Low'),
        ('Medium',   'Medium'),
        ('High',     'High'),
        ('Critical', 'Critical'),
    ]
    severity       = models.CharField(max_length=20, choices=severity_choices, default='Medium')
    risk_score     = models.FloatField()
    description    = models.TextField()
    ai_explanation = models.TextField(blank=True, null=True)
    resolved       = models.BooleanField(default=False)

    # Notification tracking
    email_sent    = models.BooleanField(default=False)
    sms_sent      = models.BooleanField(default=False)
    notified_at   = models.DateTimeField(null=True, blank=True)

    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"[{self.severity}] {self.type} Alert (score={self.risk_score}) — Trip {self.trip.trip_id}"


# ============================================================
# Journey Report (Pre-Journey Risk Report snapshot)
# ============================================================

class JourneyReport(models.Model):
    """
    A saved snapshot of the pre-journey risk assessment for a Trip.
    Generated on demand via POST /api/trips/{id}/pre-journey-report/
    by running the Route Agent against the trip's start/destination
    and combining it with cargo value + driver history heuristics.
    """
    report_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip      = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='journey_reports')

    baseline_route_risk  = models.FloatField(default=0.0)
    route_risk_score     = models.FloatField(default=0.0)   # 0.0 - 1.0 raw agent score
    in_safe_corridor      = models.BooleanField(default=True)
    nearest_corridor_name = models.CharField(max_length=255, blank=True, null=True)
    in_high_risk_zone     = models.BooleanField(default=False)
    high_risk_zone_name   = models.CharField(max_length=255, blank=True, null=True)

    cargo_value_factor   = models.FloatField(default=0.0, help_text="Risk contribution from cargo value")
    driver_history_factor = models.FloatField(default=0.0, help_text="Risk contribution from driver's past alerts")

    composite_risk_score = models.FloatField(default=0.0)   # 0-100 final pre-journey score
    risk_level           = models.CharField(max_length=20, default='LOW')
    recommendations       = models.JSONField(default=list, blank=True)
    summary               = models.TextField(blank=True, null=True)

    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-generated_at']

    def __str__(self):
        return f"Pre-Journey Report for Trip {self.trip.trip_id} @ {self.generated_at} ({self.risk_level})"
