"""
Administration app — manages administrative hierarchy:
State → District → Block → Village → Custom

This app stores administrative unit boundaries and hierarchy.
Geometry is stored as GeoJSON text in SQLite (no PostGIS required).
"""
default_app_config = "apps.administration.apps.AdministrationConfig"
