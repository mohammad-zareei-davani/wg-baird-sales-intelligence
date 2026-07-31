"""Central configuration for reporting assumptions and analysis thresholds.

Everything a reviewer might reasonably challenge ("why 120 days?", "what
rate did you convert at?") lives here rather than being buried in the
analytics, so the assumptions are visible, documented and adjustable
without touching analysis code.
"""
from __future__ import annotations

import os

# --- Reporting currency -----------------------------------------------------
# The dataset records sell prices in the customer's home currency (Euro or
# Stg) in a single column. Summing that column raw adds euros to pounds and
# produces a meaningless total, so every money figure is converted to one
# base currency before aggregation.
#
# W&G Baird is Northern Ireland based, so Stg is the natural base. The rate
# is a planning assumption, not a live FX feed — it is surfaced in the UI
# and overridable via the BAIRD_EUR_GBP environment variable.
BASE_CURRENCY = "GBP"
BASE_CURRENCY_SYMBOL = "£"
EUR_TO_GBP = float(os.getenv("BAIRD_EUR_GBP", "0.86"))

FX_RATES = {
    "Stg": 1.0,
    "Euro": EUR_TO_GBP,
}

# --- Churn / dormancy -------------------------------------------------------
# Scored against each customer's own cadence: a customer is "At Risk" once
# the silence exceeds their normal gap by 25%, and "Dormant" past 2.5x.
AT_RISK_INTERVAL_MULTIPLE = 1.25
DORMANT_INTERVAL_MULTIPLE = 2.5
# Fallback absolute thresholds for customers with too little history to have
# a meaningful cadence.
FALLBACK_AT_RISK_DAYS = 120
FALLBACK_DORMANT_DAYS = 270
MIN_ORDERS_FOR_CADENCE = 3

# --- Reorder forecasting ----------------------------------------------------
DUE_SOON_DAYS = 14
FORECAST_HORIZON_DAYS = 30

# --- Pricing / margin integrity ---------------------------------------------
# A job whose value added is below this share of its sell price is earning
# too little to cover overhead, even though it is not technically a loss.
LOW_MARGIN_VA_PCT = 0.25
# Quote Guard flags a job when the actual price falls this far below the
# price the model expected for comparable work.
UNDERPRICED_THRESHOLD_PCT = 0.20

# --- Repeat / reprint work --------------------------------------------------
# Two runs of the same title a few days apart are one order split across
# lines, not a genuine reprint. Titles whose average cycle is shorter than
# this are kept in the repeat-revenue figures but excluded from the "due a
# reprint" call list, where they would otherwise always look overdue.
MIN_REPRINT_CYCLE_DAYS = 30

# --- Delivery ---------------------------------------------------------------
# Lead times beyond this are treated as data artefacts (cancelled/reopened
# jobs) rather than genuine turnaround, and excluded from averages.
MAX_PLAUSIBLE_LEAD_DAYS = 180
