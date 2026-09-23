"""Administration admin registration"""
from django.contrib import admin
from .models import AdministrativeUnit


@admin.register(AdministrativeUnit)
class AdministrativeUnitAdmin(admin.ModelAdmin):
    list_display = ["name", "code", "level", "parent", "area_sqkm", "is_demo"]
    list_filter = ["level", "is_demo"]
    search_fields = ["name", "code"]
    readonly_fields = ["created_at", "updated_at"]
    ordering = ["level", "name"]
