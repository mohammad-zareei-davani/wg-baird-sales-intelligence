"""Pricing variance analysis (renamed from leakage).

Import ``compute_pricing_variance`` from ``analytics.pricing_variance``.
This module re-exports for any legacy import path.
"""

from analytics.pricing_variance import LIMITATION, compute_leakage, compute_pricing_variance

__all__ = ["LIMITATION", "compute_leakage", "compute_pricing_variance"]
