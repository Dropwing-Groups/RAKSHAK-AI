from django.contrib import admin
from .models import Truck, Trip, GPSLog, Alert, JourneyReport

admin.site.register(Truck)
admin.site.register(Trip)
admin.site.register(GPSLog)
admin.site.register(Alert)
admin.site.register(JourneyReport)
