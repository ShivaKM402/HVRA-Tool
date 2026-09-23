"""
Tests for the scoring engine — normalization, weightage, composite score, classification.
These are pure unit tests — no database or network required.
"""
import pytest
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")


class TestNormalization:
    """Test min-max, z-score, and rank normalization."""

    def test_min_max_basic(self):
        from scoring.normalization import normalize_min_max
        result = normalize_min_max(5.0, 0.0, 10.0)
        assert result == 5.0

    def test_min_max_zero(self):
        from scoring.normalization import normalize_min_max
        result = normalize_min_max(0.0, 0.0, 10.0)
        assert result == 0.0

    def test_min_max_max_value(self):
        from scoring.normalization import normalize_min_max
        result = normalize_min_max(10.0, 0.0, 10.0)
        assert result == 10.0

    def test_min_max_no_variance(self):
        from scoring.normalization import normalize_min_max
        # All values equal — should return target_min
        result = normalize_min_max(5.0, 5.0, 5.0)
        assert result == 0.0

    def test_min_max_clamps_to_range(self):
        from scoring.normalization import normalize_min_max
        # Value above max
        result = normalize_min_max(15.0, 0.0, 10.0)
        assert result == 10.0
        # Value below min
        result = normalize_min_max(-5.0, 0.0, 10.0)
        assert result == 0.0

    def test_batch_min_max(self):
        from scoring.normalization import normalize_batch
        values = {1: 0.0, 2: 5.0, 3: 10.0}
        result = normalize_batch(values, method="min_max")
        assert result[1] == 0.0
        assert result[2] == 5.0
        assert result[3] == 10.0

    def test_batch_empty(self):
        from scoring.normalization import normalize_batch
        result = normalize_batch({}, method="min_max")
        assert result == {}

    def test_z_score_basic(self):
        from scoring.normalization import normalize_z_score
        # Mean value should map to middle of range
        result = normalize_z_score(5.0, mean=5.0, std=2.0)
        assert 4.5 < result < 5.5  # Should be near 5.0

    def test_rank_normalization(self):
        from scoring.normalization import normalize_rank
        sorted_vals = [0.0, 5.0, 10.0]
        assert normalize_rank(0.0, sorted_vals) == 0.0
        assert normalize_rank(10.0, sorted_vals) == 10.0


class TestWeightage:
    """Test weightage rules for flood indicators."""

    def test_flood_prone_low(self):
        from scoring.weightage import get_flood_prone_area_score
        # ≤25% → 4 (documented)
        assert get_flood_prone_area_score(10.0) == 4.0
        assert get_flood_prone_area_score(25.0) == 4.0

    def test_flood_prone_moderate(self):
        from scoring.weightage import get_flood_prone_area_score
        # 25–50% → 6 (documented)
        assert get_flood_prone_area_score(30.0) == 6.0
        assert get_flood_prone_area_score(49.9) == 6.0

    def test_flood_prone_high(self):
        from scoring.weightage import get_flood_prone_area_score
        # 50–75% → 8 (documented)
        assert get_flood_prone_area_score(60.0) == 8.0

    def test_flood_prone_very_high(self):
        from scoring.weightage import get_flood_prone_area_score
        # >75% → 9 (documented)
        assert get_flood_prone_area_score(80.0) == 9.0
        assert get_flood_prone_area_score(100.0) == 9.0

    def test_event_count_no_events(self):
        from scoring.weightage import get_event_count_score
        assert get_event_count_score(0) == 0.0

    def test_event_count_low(self):
        from scoring.weightage import get_event_count_score
        assert get_event_count_score(2) == 6.0

    def test_event_count_high(self):
        from scoring.weightage import get_event_count_score
        assert get_event_count_score(8) == 10.0


class TestCompositeScoring:
    """Test composite hazard score computation."""

    def test_weighted_score_basic(self):
        from scoring.scoring import compute_weighted_score
        result = compute_weighted_score(8.0, weight=8.0, total_weight=16.0)
        assert result == 4.0  # 8 × (8/16)

    def test_composite_score_single_indicator(self):
        from scoring.scoring import compute_composite_score
        result = compute_composite_score([
            {"normalized_value": 8.0, "weight": 8.0}
        ])
        assert result == 8.0

    def test_composite_score_multiple_equal_weights(self):
        from scoring.scoring import compute_composite_score
        result = compute_composite_score([
            {"normalized_value": 6.0, "weight": 5.0},
            {"normalized_value": 8.0, "weight": 5.0},
        ])
        assert result == 7.0  # (6+8)/2

    def test_composite_score_empty(self):
        from scoring.scoring import compute_composite_score
        assert compute_composite_score([]) == 0.0

    def test_composite_score_zero_weights(self):
        from scoring.scoring import compute_composite_score
        result = compute_composite_score([
            {"normalized_value": 8.0, "weight": 0.0}
        ])
        assert result == 0.0


class TestClassification:
    """Test hazard classification."""

    def test_classify_nh(self):
        from scoring.classification import classify_by_threshold
        assert classify_by_threshold(0.0) == "NH"
        assert classify_by_threshold(2.0) == "NH"
        assert classify_by_threshold(3.9) == "NH"

    def test_classify_lh(self):
        from scoring.classification import classify_by_threshold
        assert classify_by_threshold(4.0) == "LH"
        assert classify_by_threshold(5.9) == "LH"

    def test_classify_mh(self):
        from scoring.classification import classify_by_threshold
        assert classify_by_threshold(6.0) == "MH"
        assert classify_by_threshold(7.9) == "MH"

    def test_classify_hh(self):
        from scoring.classification import classify_by_threshold
        assert classify_by_threshold(8.0) == "HH"
        assert classify_by_threshold(10.0) == "HH"

    def test_classify_batch(self):
        from scoring.classification import classify_batch
        scores = {1: 2.0, 2: 5.0, 3: 7.0, 4: 9.0}
        result = classify_batch(scores, method="threshold")
        assert result[1] == "NH"
        assert result[2] == "LH"
        assert result[3] == "MH"
        assert result[4] == "HH"

    def test_classify_quantile(self):
        from scoring.classification import classify_by_quantile
        all_scores = [1.0, 3.0, 6.0, 9.0]
        # Lowest score → NH
        cls = classify_by_quantile(1.0, all_scores)
        assert cls in ("NH", "LH")  # Should be near bottom
        # Highest score → HH
        cls = classify_by_quantile(9.0, all_scores)
        assert cls in ("MH", "HH")  # Should be near top

    def test_classification_summary(self):
        from scoring.classification import get_classification_summary
        classifications = {1: "NH", 2: "LH", 3: "MH", 4: "HH", 5: "HH"}
        summary = get_classification_summary(classifications)
        assert summary["NH"] == 1
        assert summary["LH"] == 1
        assert summary["MH"] == 1
        assert summary["HH"] == 2
