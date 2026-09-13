from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    LogisticsCompany, ControlAreaContact, CompanyUser, Truck, Trip, GPSLog, Alert,
    JourneyReport,
)


class CompanyUserSerializer(serializers.ModelSerializer):
    username   = serializers.CharField(source='user.username', read_only=True)
    email      = serializers.EmailField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name  = serializers.CharField(source='user.last_name', read_only=True)
    full_name  = serializers.ReadOnlyField()
    company_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model  = CompanyUser
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'full_name',
            'role', 'company', 'company_name', 'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_company_name(self, obj):
        return obj.company.name if obj.company else "Platform Admin"


class ControlAreaContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = ControlAreaContact
        fields = '__all__'
        read_only_fields = ['contact_id', 'created_at']


class LogisticsCompanySerializer(serializers.ModelSerializer):
    contacts       = ControlAreaContactSerializer(many=True, read_only=True)
    active_trucks  = serializers.ReadOnlyField()   # trucks with active=True
    active_trips   = serializers.ReadOnlyField()   # trips with Scheduled/In-Transit
    total_trucks   = serializers.SerializerMethodField()
    total_trips    = serializers.SerializerMethodField()

    class Meta:
        model  = LogisticsCompany
        fields = '__all__'
        read_only_fields = ['company_id', 'joined_date', 'created_at', 'updated_at']

    def get_total_trucks(self, obj):
        return obj.trucks.count()

    def get_total_trips(self, obj):
        from django.apps import apps
        Trip = apps.get_model('surveillance', 'Trip')
        return Trip.objects.filter(truck__company=obj).count()


class TruckSerializer(serializers.ModelSerializer):
    company_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model  = Truck
        fields = '__all__'
        read_only_fields = ['truck_id', 'created_at', 'updated_at']

    def get_company_name(self, obj):
        return obj.company.name if obj.company else None


class TripSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Trip
        fields = '__all__'
        read_only_fields = ['trip_id']

    def validate_baseline_route_risk(self, value):
        if not (0.0 <= value <= 100.0):
            raise serializers.ValidationError("Risk must be between 0 and 100.")
        return value

    def validate_current_calculated_risk(self, value):
        if not (0.0 <= value <= 100.0):
            raise serializers.ValidationError("Risk must be between 0 and 100.")
        return value


class GPSLogSerializer(serializers.ModelSerializer):
    class Meta:
        model  = GPSLog
        fields = '__all__'
        read_only_fields = ['log_id', 'timestamp']

    def validate_latitude(self, value):
        if not (-90.0 <= value <= 90.0):
            raise serializers.ValidationError("Latitude must be between -90 and 90.")
        return value

    def validate_longitude(self, value):
        if not (-180.0 <= value <= 180.0):
            raise serializers.ValidationError("Longitude must be between -180 and 180.")
        return value

    def validate_speed_kmh(self, value):
        if not (0.0 <= value <= 160.0):
            raise serializers.ValidationError("Speed must be between 0 and 160 km/h.")
        return value

    def validate_heading(self, value):
        if not (0.0 <= value <= 360.0):
            raise serializers.ValidationError("Heading must be between 0 and 360 degrees.")
        return value



class AlertSerializer(serializers.ModelSerializer):
    # Expose the truck plate directly so the frontend can display it without
    # needing a deep nested serializer.
    truck_license_plate = serializers.SerializerMethodField(read_only=True)
    # 'type' is a Python reserved word in some contexts; alias it for the frontend
    alert_type = serializers.CharField(source='type', read_only=True)
    # Friendly alias for the frontend that uses d.severity
    severity = serializers.CharField(read_only=True)
    # Expose trip_id and latest GPS coordinates so the frontend can show location
    trip_id  = serializers.SerializerMethodField(read_only=True)
    gps_lat  = serializers.SerializerMethodField(read_only=True)
    gps_lng  = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model  = Alert
        fields = '__all__'
        read_only_fields = ['alert_id', 'timestamp', 'email_sent', 'sms_sent', 'notified_at']

    def get_truck_license_plate(self, obj):
        try:
            return obj.trip.truck.license_plate
        except Exception:
            return None

    def get_trip_id(self, obj):
        try:
            return str(obj.trip.trip_id)
        except Exception:
            return None

    def _latest_gps(self, obj):
        """Return the most recent GPSLog for this alert's trip, or None."""
        try:
            return obj.trip.gps_logs.order_by('-timestamp').first()
        except Exception:
            return None

    def get_gps_lat(self, obj):
        log = self._latest_gps(obj)
        return float(log.latitude) if log else None

    def get_gps_lng(self, obj):
        log = self._latest_gps(obj)
        return float(log.longitude) if log else None

    def validate_risk_score(self, value):
        if not (0.0 <= value <= 100.0):
            raise serializers.ValidationError("Risk score must be between 0 and 100.")
        return value


class JourneyReportSerializer(serializers.ModelSerializer):
    trip_id = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model  = JourneyReport
        fields = '__all__'
        read_only_fields = ['report_id', 'generated_at']

    def get_trip_id(self, obj):
        return str(obj.trip.trip_id)

