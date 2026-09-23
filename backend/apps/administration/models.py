"""
Administration models.

AdministrativeUnit stores the administrative hierarchy:
  STATE (level=1) → DISTRICT (level=2) → BLOCK (level=3)
  → VILLAGE (level=4) → CUSTOM (level=5)

Geometry is stored as GeoJSON text in SQLite.
GIS operations are performed by GeoPandas/Shapely in the gis/ layer.

NOTE: All seed data is clearly labelled with is_demo=True.
      It must NOT be presented as official government data.
"""
import json
from django.db import models


class LevelChoices(models.TextChoices):
    STATE = "STATE", "State"
    DISTRICT = "DISTRICT", "District"
    BLOCK = "BLOCK", "Block"
    VILLAGE = "VILLAGE", "Village"
    CUSTOM = "CUSTOM", "Custom"


class AdministrativeUnit(models.Model):
    """
    Represents an administrative unit at any level of the hierarchy.
    """
    name = models.CharField(max_length=255, db_index=True)
    code = models.CharField(max_length=64, unique=True, db_index=True)
    level = models.CharField(
        max_length=16,
        choices=LevelChoices.choices,
        db_index=True,
    )
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="children",
    )

    # Geometry stored as GeoJSON string (avoids PostGIS dependency)
    # Structure: {"type": "Polygon", "coordinates": [...]}
    geometry_geojson = models.TextField(null=True, blank=True)

    # Area in sq. km (pre-computed for performance)
    area_sqkm = models.FloatField(null=True, blank=True)

    # Centroid coordinates for map display
    centroid_lat = models.FloatField(null=True, blank=True)
    centroid_lon = models.FloatField(null=True, blank=True)

    # Bounding box for quick spatial filtering
    bbox_minx = models.FloatField(null=True, blank=True)
    bbox_miny = models.FloatField(null=True, blank=True)
    bbox_maxx = models.FloatField(null=True, blank=True)
    bbox_maxy = models.FloatField(null=True, blank=True)

    # Metadata
    is_demo = models.BooleanField(
        default=False,
        help_text="True if this is DEMO DATA, not official government data.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "administrative_unit"
        verbose_name = "Administrative Unit"
        verbose_name_plural = "Administrative Units"
        ordering = ["level", "name"]

    def __str__(self):
        demo_tag = " [DEMO]" if self.is_demo else ""
        return f"{self.name} ({self.level}){demo_tag}"

    @property
    def geometry(self):
        """Return geometry as Python dict (GeoJSON)."""
        if self.geometry_geojson:
            return json.loads(self.geometry_geojson)
        return None

    @geometry.setter
    def geometry(self, geojson_dict):
        """Set geometry from Python dict."""
        if geojson_dict is not None:
            self.geometry_geojson = json.dumps(geojson_dict)
        else:
            self.geometry_geojson = None

    def get_ancestors(self):
        """Return list of ancestors from root to self."""
        ancestors = []
        unit = self
        while unit.parent:
            ancestors.insert(0, unit.parent)
            unit = unit.parent
        return ancestors

    def get_descendants(self, level=None):
        """Return all descendant units, optionally filtered by level."""
        qs = AdministrativeUnit.objects.filter(
            parent=self
        )
        if level:
            # Recursively get descendants at specified level
            all_desc = list(qs)
            for child in qs:
                all_desc.extend(child.get_descendants(level=level))
            if level:
                return [d for d in all_desc if d.level == level]
            return all_desc
        return list(qs)

    def to_geojson_feature(self):
        """Return as a GeoJSON Feature dict."""
        district_name = ""
        state_name = ""
        if self.level == "BLOCK":
            district_name = self.parent.name if self.parent else ""
            state_name = self.parent.parent.name if self.parent and self.parent.parent else ""
        elif self.level == "DISTRICT":
            district_name = self.name
            state_name = self.parent.name if self.parent else ""
        elif self.level == "STATE":
            state_name = self.name

        return {
            "type": "Feature",
            "geometry": self.geometry,
            "properties": {
                "id": self.id,
                "name": self.name,
                "code": self.code,
                "level": self.level,
                "area_sqkm": self.area_sqkm,
                "centroid_lat": self.centroid_lat,
                "centroid_lon": self.centroid_lon,
                "district": district_name,
                "state": state_name,
                "is_demo": self.is_demo,
            },
        }

