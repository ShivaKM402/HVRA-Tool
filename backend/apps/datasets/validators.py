"""
Dataset validation engine.
Validates uploaded CSV, GeoJSON, and Shapefile datasets.
Checks format, geometry, CRS, required fields, and data quality.
"""
import json
import csv
import zipfile
import io
from pathlib import Path


class DatasetValidator:
    """
    Validates an UploadedDataset record.
    Sets status, validation_errors, validation_warnings on the dataset.
    """

    def __init__(self, dataset):
        self.dataset = dataset
        self.errors = []
        self.warnings = []

    def validate(self):
        """Run all validations and update the dataset record."""
        try:
            fmt = self.dataset.file_format
            if fmt == "CSV":
                self._validate_csv()
            elif fmt == "GEOJSON":
                self._validate_geojson()
            elif fmt == "SHAPEFILE":
                self._validate_shapefile()
            else:
                self.errors.append(f"Unknown format: {fmt}")
        except Exception as e:
            self.errors.append(f"Validation error: {str(e)}")

        self.dataset.status = "INVALID" if self.errors else "VALID"
        self.dataset.validation_errors = self.errors
        self.dataset.validation_warnings = self.warnings
        self.dataset.save(update_fields=["status", "validation_errors", "validation_warnings", "record_count"])

    def _read_file_bytes(self):
        """Read the uploaded file and return bytes."""
        self.dataset.file.seek(0)
        return self.dataset.file.read()

    def _validate_csv(self):
        """Validate CSV file."""
        try:
            content = self._read_file_bytes().decode("utf-8-sig")
        except UnicodeDecodeError:
            try:
                content = self._read_file_bytes().decode("latin-1")
                self.warnings.append("File encoding is not UTF-8. Consider re-saving as UTF-8.")
            except Exception:
                self.errors.append("Cannot decode file. Ensure it is UTF-8 or Latin-1 encoded.")
                return

        try:
            reader = csv.DictReader(io.StringIO(content))
            rows = list(reader)
        except csv.Error as e:
            self.errors.append(f"Invalid CSV format: {str(e)}")
            return

        if not rows:
            self.errors.append("CSV file is empty (no data rows).")
            return

        self.dataset.record_count = len(rows)

        # Check for coordinate columns if spatial data
        fieldnames = [f.lower() for f in (reader.fieldnames or [])]
        has_lat = any(f in fieldnames for f in ["lat", "latitude", "y"])
        has_lon = any(f in fieldnames for f in ["lon", "lng", "longitude", "x"])

        if not has_lat or not has_lon:
            self.warnings.append(
                "No latitude/longitude columns detected. "
                "For spatial data, include 'latitude'/'longitude' columns."
            )

        # Check for date column
        has_date = any(f in fieldnames for f in ["date", "event_date", "year"])
        if not has_date:
            self.warnings.append("No date column detected. Expected 'date' or 'event_date'.")

        # Check for duplicate rows
        if len(rows) != len(set(str(r) for r in rows)):
            self.warnings.append("Possible duplicate rows detected.")

        # Validate coordinate values
        if has_lat and has_lon:
            invalid_coords = 0
            lat_col = next((f for f in (reader.fieldnames or []) if f.lower() in ["lat", "latitude", "y"]), None)
            lon_col = next((f for f in (reader.fieldnames or []) if f.lower() in ["lon", "lng", "longitude", "x"]), None)
            for row in rows:
                try:
                    lat = float(row.get(lat_col, ""))
                    lon = float(row.get(lon_col, ""))
                    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                        invalid_coords += 1
                except (ValueError, TypeError):
                    invalid_coords += 1
            if invalid_coords > 0:
                self.errors.append(f"{invalid_coords} rows have invalid coordinates.")

    def _validate_geojson(self):
        """Validate GeoJSON file."""
        try:
            content = self._read_file_bytes().decode("utf-8")
            data = json.loads(content)
        except (UnicodeDecodeError, json.JSONDecodeError) as e:
            self.errors.append(f"Invalid GeoJSON: {str(e)}")
            return

        fc_type = data.get("type")
        if fc_type not in ("FeatureCollection", "Feature", "GeometryCollection"):
            self.errors.append(f"GeoJSON must be a FeatureCollection or Feature, got: {fc_type}")
            return

        if fc_type == "FeatureCollection":
            features = data.get("features", [])
            if not features:
                self.warnings.append("GeoJSON FeatureCollection has no features.")
            self.dataset.record_count = len(features)

            # Validate feature geometries
            invalid_geom = 0
            for feature in features:
                geom = feature.get("geometry")
                if not geom or geom.get("type") not in (
                    "Point", "MultiPoint", "LineString", "MultiLineString",
                    "Polygon", "MultiPolygon", "GeometryCollection"
                ):
                    invalid_geom += 1
            if invalid_geom:
                self.errors.append(f"{invalid_geom} features have invalid or null geometry.")

    def _validate_shapefile(self):
        """Validate zipped Shapefile."""
        try:
            content = self._read_file_bytes()
            with zipfile.ZipFile(io.BytesIO(content)) as zf:
                names = zf.namelist()
                exts = {Path(n).suffix.lower() for n in names}
                required = {".shp", ".dbf"}
                missing = required - exts
                if missing:
                    self.errors.append(
                        f"Shapefile ZIP is missing required files: {', '.join(missing)}. "
                        f"Found: {', '.join(names)}"
                    )
                if ".prj" not in exts:
                    self.warnings.append(
                        "No .prj file found. CRS will be assumed as EPSG:4326. "
                        "Include a .prj file to specify the coordinate system."
                    )
                self.dataset.record_count = None  # Would need fiona to count
        except zipfile.BadZipFile:
            self.errors.append("File is not a valid ZIP archive.")
        except Exception as e:
            self.errors.append(f"Shapefile validation error: {str(e)}")
