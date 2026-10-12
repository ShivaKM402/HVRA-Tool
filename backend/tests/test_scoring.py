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

    def test_directional_inverted(self):
        from scoring.normalization import normalize_min_max
        # Inverted normalization: higher raw value yields lower risk/vulnerability score
        direct = normalize_min_max(8.0, 0.0, 10.0, direction="direct")
        inverted = normalize_min_max(8.0, 0.0, 10.0, direction="inverted")
        assert direct == 8.0
        assert inverted == 2.0

    def test_reference_normalization(self):
        from scoring.normalization import normalize_reference
        # Physical reference thresholds Li=20, Ui=100
        val = normalize_reference(60.0, lower_ref=20.0, upper_ref=100.0, direction="direct")
        assert val == 5.0  # (60 - 20) / (100 - 20) * 10 = 40/80 * 10 = 5.0

    def test_reference_clamping(self):
        from scoring.normalization import normalize_reference
        # Above Ui should clamp to 10.0, below Li should clamp to 0.0
        high = normalize_reference(150.0, lower_ref=20.0, upper_ref=100.0, direction="direct")
        low = normalize_reference(5.0, lower_ref=20.0, upper_ref=100.0, direction="direct")
        assert high == 10.0
        assert low == 0.0

    def test_reference_inverted(self):
        from scoring.normalization import normalize_reference
        # Inverted reference: higher capacity / resilience = lower score
        # x = 80, Li = 0, Ui = 100 -> (100 - 80) / 100 * 10 = 2.0
        res = normalize_reference(80.0, lower_ref=0.0, upper_ref=100.0, direction="inverted")
        assert res == 2.0

    def test_reference_zero_range(self):
        from scoring.normalization import normalize_reference
        # Ui == Li (zero range) returns target_min
        res = normalize_reference(50.0, lower_ref=50.0, upper_ref=50.0)
        assert res == 0.0


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
    """Test hazard classification with official KSDMA HVRA thresholds."""

    def test_classify_nh(self):
        from scoring.classification import classify_by_threshold
        assert classify_by_threshold(0.0) == "NH"
        assert classify_by_threshold(1.0) == "NH"
        assert classify_by_threshold(1.4) == "NH"

    def test_classify_lh(self):
        from scoring.classification import classify_by_threshold
        assert classify_by_threshold(1.5) == "LH"
        assert classify_by_threshold(3.9) == "LH"

    def test_classify_mh(self):
        from scoring.classification import classify_by_threshold
        assert classify_by_threshold(4.0) == "MH"
        assert classify_by_threshold(6.9) == "MH"

    def test_classify_hh(self):
        from scoring.classification import classify_by_threshold
        assert classify_by_threshold(7.0) == "HH"
        assert classify_by_threshold(10.0) == "HH"

    def test_classify_batch(self):
        from scoring.classification import classify_batch
        scores = {1: 1.0, 2: 2.5, 3: 5.0, 4: 8.0}
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


class TestRiskEngine:
    """Test composite Risk calculations (H, V, E synthesis)."""

    def test_geometric_mean_sample_case(self):
        from scoring.risk import weighted_geometric_mean
        # User audit representative test case: H=7.3, V=7.15, E=8.0 with equal weights
        scores = {"hazard": 7.3, "vulnerability": 7.15, "exposure": 8.0}
        weights = {"hazard": 1.0, "vulnerability": 1.0, "exposure": 1.0}
        result = weighted_geometric_mean(scores, weights)
        # Expected: (7.3 * 7.15 * 8.0)^(1/3) = 417.56^(1/3) = 7.4743
        assert pytest.approx(result, rel=1e-3) == 7.4743

    def test_geometric_mean_zero_annihilation(self):
        from scoring.risk import weighted_geometric_mean
        # Multiplicative: if hazard is 0, risk score is 0
        scores = {"hazard": 0.0, "vulnerability": 7.5, "exposure": 8.0}
        weights = {"hazard": 1.0, "vulnerability": 1.0, "exposure": 1.0}
        assert weighted_geometric_mean(scores, weights) == 0.0

    def test_additive_risk(self):
        from scoring.risk import weighted_sum
        scores = {"hazard": 6.0, "vulnerability": 4.0, "exposure": 8.0}
        weights = {"hazard": 1.0, "vulnerability": 1.0, "exposure": 2.0}
        # (6*1 + 4*1 + 8*2) / 4 = 26 / 4 = 6.5
        assert weighted_sum(scores, weights) == 6.5

    def test_compute_risk_scores_complete(self):
        from scoring.risk import compute_risk_scores
        module_scores = {
            101: {"hazard": 7.3, "vulnerability": 7.15, "exposure": 8.0}
        }
        weights = {"hazard": 1.0, "vulnerability": 1.0, "exposure": 1.0}
        res = compute_risk_scores(module_scores, weights, formula="MULTIPLICATIVE")
        unit_res = res[101]
        assert pytest.approx(unit_res["risk_score"], rel=1e-3) == 7.4743
        assert unit_res["risk_class"] == "HIGH"
        assert unit_res["is_complete"] is True
        assert unit_res["missing_components"] == []
        assert unit_res["data_completeness_warning"] is None

    def test_compute_risk_scores_missing_component(self):
        from scoring.risk import compute_risk_scores
        # Exposure missing
        module_scores = {
            102: {"hazard": 6.0, "vulnerability": 6.0, "exposure": None}
        }
        weights = {"hazard": 1.0, "vulnerability": 1.0, "exposure": 1.0}
        res = compute_risk_scores(module_scores, weights, formula="MULTIPLICATIVE")
        unit_res = res[102]
        assert unit_res["is_complete"] is False
        assert unit_res["missing_components"] == ["exposure"]
        assert unit_res["data_completeness_warning"] is not None
        assert "exposure" in unit_res["data_completeness_warning"]
        # Evaluated over active components
        assert unit_res["risk_score"] == 6.0

    def test_5_tier_classification(self):
        from scoring.risk import classify_risk
        # 5-tier: <2 LOW, 2-4 MODERATE, 4-6 HIGH, 6-8 VERY_HIGH, >=8 EXTREME
        assert classify_risk(1.5, tier_system="5_tier") == "LOW"
        assert classify_risk(3.0, tier_system="5_tier") == "MODERATE"
        assert classify_risk(5.0, tier_system="5_tier") == "HIGH"
        assert classify_risk(7.0, tier_system="5_tier") == "VERY_HIGH"
        assert classify_risk(8.5, tier_system="5_tier") == "EXTREME"

