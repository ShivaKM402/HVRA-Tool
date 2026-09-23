"""
Scoring package — hazard scoring engine.

Architecture:
  normalization.py  — normalize raw values to 0–10 scale
  weightage.py      — apply indicator weights
  scoring.py        — compute composite hazard score
  classification.py — classify score as NH/LH/MH/HH

All scoring logic is isolated here.
NEVER in React. NEVER in Django views.
All methods are deterministic and independently testable.
"""
