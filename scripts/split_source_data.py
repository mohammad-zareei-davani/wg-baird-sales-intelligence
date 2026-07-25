"""
Split the source workbook into history (≤2025-12-31) and
2026 update (≥2026-01-01) files under data/raw/.

Usage (from repo root):
    python scripts/split_source_data.py
    python scripts/split_source_data.py --source path/to/workbook.xlsx
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = (
    Path(r"c:\Users\zaree\OneDrive\Desktop\KTP")
    / "Queen's University"
    / "SampleDataSet_0724261220455600546.xlsx"
)
SHEET = "Master Plain (Anon)"
CUTOFF = pd.Timestamp("2025-12-31")
UPDATE_START = pd.Timestamp("2026-01-01")


def split_workbook(source: Path, out_dir: Path) -> tuple[int, int, int]:
    out_dir.mkdir(parents=True, exist_ok=True)

    df = pd.read_excel(source, sheet_name=SHEET)
    total = len(df)
    sales_in = pd.to_datetime(df["SalesIn"])

    history = df.loc[sales_in <= CUTOFF].copy()
    update = df.loc[sales_in >= UPDATE_START].copy()

    history_path = out_dir / "history_2023_2025.xlsx"
    update_path = out_dir / "update_2026.xlsx"

    history.to_excel(history_path, index=False, sheet_name=SHEET)
    update.to_excel(update_path, index=False, sheet_name=SHEET)

    return len(history), len(update), total


def main() -> None:
    parser = argparse.ArgumentParser(description="Split source workbook into history and 2026 update.")
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help="Path to the source SampleDataSet workbook",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=REPO_ROOT / "data" / "raw",
        help="Output directory for split workbooks",
    )
    args = parser.parse_args()

    if not args.source.exists():
        raise FileNotFoundError(f"Source workbook not found: {args.source}")

    n_history, n_update, n_total = split_workbook(args.source, args.out_dir)

    print(f"Source:  {args.source}")
    print(f"Output:  {args.out_dir}")
    print(f"History (SalesIn <= 2025-12-31): {n_history:,}")
    print(f"Update  (SalesIn >= 2026-01-01): {n_update:,}")
    print(f"Total:   {n_total:,}")
    print(f"Sum check (history + update == total): {n_history + n_update == n_total}")


if __name__ == "__main__":
    main()
