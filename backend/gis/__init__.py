"""
GIS package — spatial processing layer.

Architecture:
  spatial.py   — high-level spatial operations
  overlays.py  — polygon overlay operations
  geometry.py  — geometry utilities

All GIS operations happen here.
NO GIS logic in React or Django views.
Uses GeoPandas + Shapely. No PostGIS/SpatiaLite required.
"""
