"""
Hazards models.

HazardType — catalogue of supported hazards
HazardEvent — historical hazard occurrences (point data)
HazardLayer — spatial layers (polygon data e.g. flood-prone areas)
HazardIndicator — indicator definitions with default weights
IndicatorWeightageRule — documented weightage rules per indicator value range

NOTE: All seed data is clearly labelled with is_demo=True.
      It must NOT be presented as official government data.
"""
import json
from django.db import models


class HazardTypeChoices(models.TextChoices):
    FLOOD = "FLOOD", "Flood"
    EARTHQUAKE = "EARTHQUAKE", "Earthquake"
    CYCLONE = "CYCLONE", "Cyclone"
    LANDSLIDE = "LANDSLIDE", "Landslide"
    DROUGHT = "DROUGHT", "Drought"
    FOREST_FIRE = "FOREST_FIRE", "Forest Fire"


class HazardType(models.Model):
    """Catalogue of supported hazard types."""
    code = models.CharField(max_length=32, unique=True, primary_key=True)
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(
        default=False,
        help_text="True if this hazard is fully implemented in the prototype.",
    )
    icon = models.CharField(max_length=64, blank=True)
    color = models.CharField(max_length=16, blank=True, default="#3B82F6")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "hazard_type"
        verbose_name = "Hazard Type"
        ordering = ["name"]

    def __str__(self):
        active = "" if self.is_active else " (Coming Soon)"
        return f"{self.name}{active}"


class HazardEvent(models.Model):
    """
    A historical hazard event (point-referenced).
    Used for: counting events per block, frequency calculation.
    """
    hazard_type = models.CharField(
        max_length=32, choices=HazardTypeChoices.choices, db_index=True
    )
    event_date = models.DateField(db_index=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    administrative_unit = models.ForeignKey(
        "administration.AdministrativeUnit",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="hazard_events",
        help_text="Pre-assigned admin unit (set by GIS processing).",
    )
    magnitude = models.FloatField(
        null=True, blank=True, help_text="Magnitude or intensity (hazard-specific unit)."
    )
    loss = models.FloatField(
        null=True, blank=True, help_text="Estimated loss (INR crore)."
    )
    description = models.TextField(blank=True)
    source = models.CharField(max_length=255, blank=True)
    source_url = models.URLField(blank=True)

    # Geometry stored as GeoJSON Point text
    geometry_geojson = models.TextField(null=True, blank=True)

    is_demo = models.BooleanField(
        default=False,
        help_text="True if this is DEMO DATA, not official historical data.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "hazard_event"
        verbose_name = "Hazard Event"
        verbose_name_plural = "Hazard Events"
        ordering = ["-event_date"]

    def __str__(self):
        demo_tag = " [DEMO]" if self.is_demo else ""
        return f"{self.hazard_type} on {self.event_date} at ({self.latitude:.4f}, {self.longitude:.4f}){demo_tag}"

    @property
    def geometry(self):
        if self.geometry_geojson:
            return json.loads(self.geometry_geojson)
        return {
            "type": "Point",
            "coordinates": [self.longitude, self.latitude],
        }


class HazardLayer(models.Model):
    """
    A spatial layer representing hazard-prone areas.
    Example: Flood-prone polygon layer.
    Geometry stored as GeoJSON FeatureCollection text.
    """
    name = models.CharField(max_length=255)
    hazard_type = models.CharField(max_length=32, choices=HazardTypeChoices.choices)
    geometry_type = models.CharField(
        max_length=32,
        choices=[
            ("POLYGON", "Polygon"),
            ("POINT", "Point"),
            ("LINE", "Line / Linestring"),
        ],
    )
    source = models.CharField(max_length=255, blank=True)
    source_url = models.URLField(blank=True)
    organization = models.CharField(max_length=255, blank=True)
    vintage = models.CharField(max_length=32, blank=True, help_text="Data vintage year or period.")
    crs = models.CharField(max_length=64, default="EPSG:4326", help_text="Coordinate Reference System.")
    metadata = models.JSONField(default=dict, blank=True)

    # GeoJSON FeatureCollection text
    geometry_geojson = models.TextField(null=True, blank=True)

    is_demo = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "hazard_layer"
        verbose_name = "Hazard Layer"

    def __str__(self):
        demo_tag = " [DEMO]" if self.is_demo else ""
        return f"{self.name} ({self.hazard_type}){demo_tag}"

    @property
    def geometry(self):
        if self.geometry_geojson:
            return json.loads(self.geometry_geojson)
        return None


class HazardIndicator(models.Model):
    """
    Definition of a hazard indicator with default weightage.
    Weights and thresholds are configurable — not hard-coded.
    """
    hazard_type = models.CharField(max_length=32, choices=HazardTypeChoices.choices)
    code = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    unit = models.CharField(max_length=64, blank=True)
    default_weight = models.FloatField(default=5.0, help_text="Default weight on 0–10 scale.")
    min_weight = models.FloatField(default=0.0)
    max_weight = models.FloatField(default=10.0)
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "hazard_indicator"
        verbose_name = "Hazard Indicator"
        ordering = ["hazard_type", "order", "name"]

    def __str__(self):
        return f"{self.hazard_type} — {self.name}"


class IndicatorWeightageRule(models.Model):
    """
    Documented weightage rules for an indicator.
    Example: flood-prone area ≤25% → score 4

    IMPORTANT: These are PROTOTYPE thresholds.
    They are NOT official government classification values.
    They are stored as configurable rules, not hard-coded.
    """
    indicator = models.ForeignKey(
        HazardIndicator,
        on_delete=models.CASCADE,
        related_name="weightage_rules",
    )
    label = models.CharField(max_length=64, help_text="e.g. 'Low', 'Moderate', 'High'")
    range_min = models.FloatField(help_text="Inclusive lower bound of value range.")
    range_max = models.FloatField(
        null=True, blank=True, help_text="Exclusive upper bound. Null = no upper bound."
    )
    score = models.FloatField(help_text="Score assigned to this range (0–10 scale).")
    description = models.TextField(blank=True)
    is_prototype_threshold = models.BooleanField(
        default=True,
        help_text="True = prototype/configurable threshold, False = official documented threshold.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "indicator_weightage_rule"
        verbose_name = "Indicator Weightage Rule"
        ordering = ["indicator", "range_min"]

    def __str__(self):
        upper = f"–{self.range_max}" if self.range_max else "+"
        return f"{self.indicator.code}: {self.range_min}{upper} → {self.score}"
