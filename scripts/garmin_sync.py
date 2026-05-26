#!/usr/bin/env python3
"""
garmin_sync.py — pull last night's sleep from Garmin Connect and push it into
the somn Google Sheet (the same sheet /api/sheets reads from).

Env vars:
  GARMIN_USERNAME   (required)
  GARMIN_PASSWORD   (required)
  SHEETS_API_URL    (optional — defaults to the prod Apps Script URL)
  SOMN_NAME         (optional — defaults to "Petrica Cosmin Moga")
  SYNC_DATE         (optional — YYYY-MM-DD, defaults to yesterday in Bucharest)
  DRY_RUN           (optional — "1" to skip the POST and just print)
"""

from __future__ import annotations

import os
import sys
from datetime import date, datetime, timedelta
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

import requests
from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)

DEFAULT_SHEETS_API = (
    "https://script.google.com/macros/s/"
    "AKfycbwNbyFuoNJV6XPAWbwANg1DOuW9rBshHlBrm3cLPcDeZORwu2L2k8N6VoHYNKdoyKhYtg/exec"
)
DEFAULT_NAME = "Petrica Cosmin Moga"
TZ = ZoneInfo("Europe/Bucharest")


def log(msg: str) -> None:
    print(f"[garmin-sync] {msg}", flush=True)


def resolve_date() -> str:
    override = os.environ.get("SYNC_DATE", "").strip()
    if override:
        # Validate format
        datetime.strptime(override, "%Y-%m-%d")
        return override
    yesterday = datetime.now(TZ).date() - timedelta(days=1)
    return yesterday.isoformat()


def login() -> Garmin:
    user = os.environ.get("GARMIN_USERNAME", "").strip()
    pwd = os.environ.get("GARMIN_PASSWORD", "")
    if not user or not pwd:
        log("ERROR: GARMIN_USERNAME / GARMIN_PASSWORD not set")
        sys.exit(2)
    client = Garmin(user, pwd)
    client.login()
    return client


def extract_sleep(raw: dict, target_date: str) -> dict | None:
    """
    Map the raw Garmin sleep payload → the fields somn cares about.
    Returns None if the night isn't logged yet.
    """
    daily = raw.get("dailySleepDTO") or {}
    if not daily:
        return None

    # Sleep score — under sleepScores.overall.value (0-100)
    scores = daily.get("sleepScores") or {}
    overall = (scores.get("overall") or {}).get("value")

    # REM minutes — remSleepSeconds → minutes (rounded)
    rem_sec = daily.get("remSleepSeconds")
    rem = round(rem_sec / 60) if isinstance(rem_sec, (int, float)) else None

    # HRV avg last night — under "hrvData" / "avgOvernightHrv" / "averageHRV"
    hrv = (
        raw.get("avgOvernightHrv")
        or (raw.get("hrvSummary") or {}).get("lastNightAvg")
        or daily.get("avgOvernightHrv")
    )

    return {
        "date": target_date,
        "ss": overall,
        "rem": rem,
        "hrv": int(hrv) if isinstance(hrv, (int, float)) else None,
    }


def fetch_rhr(client: Garmin, target_date: str) -> int | None:
    """Resting HR for the target date — try a few endpoints since the lib's API has shifted."""
    # Newer lib: get_rhr_day(date) → {"allMetrics": {"metricsMap": {"WELLNESS_RESTING_HEART_RATE": [...]}}}
    try:
        data = client.get_rhr_day(target_date)
    except Exception as e:
        log(f"get_rhr_day failed: {e}")
        data = None

    if isinstance(data, dict):
        metrics = (
            (data.get("allMetrics") or {})
            .get("metricsMap", {})
            .get("WELLNESS_RESTING_HEART_RATE", [])
        )
        for m in metrics:
            v = m.get("value")
            if isinstance(v, (int, float)) and v > 0:
                return int(v)

    # Fallback: get_stats(date)["restingHeartRate"]
    try:
        stats = client.get_stats(target_date)
        v = stats.get("restingHeartRate") if isinstance(stats, dict) else None
        if isinstance(v, (int, float)) and v > 0:
            return int(v)
    except Exception as e:
        log(f"get_stats fallback failed: {e}")

    return None


def fetch_hrv(client: Garmin, target_date: str) -> int | None:
    """Average overnight HRV in ms for the target date, if Garmin recorded it."""
    try:
        data = client.get_hrv_data(target_date)
    except Exception as e:
        log(f"get_hrv_data failed: {e}")
        return None
    if not isinstance(data, dict):
        return None
    summary = data.get("hrvSummary") or {}
    v = summary.get("lastNightAvg") or summary.get("weeklyAvg")
    if isinstance(v, (int, float)) and v > 0:
        return int(v)
    return None


def post_to_sheet(entry: dict, name: str) -> None:
    if entry.get("ss") is None or entry.get("rhr") is None:
        log(f"SKIP write — incomplete entry (ss={entry.get('ss')}, rhr={entry.get('rhr')})")
        return

    base = os.environ.get("SHEETS_API_URL", "").strip() or DEFAULT_SHEETS_API
    params = {
        "action": "write",
        "date": entry["date"],
        "name": name,
        "sleep_score": str(entry["ss"]),
        "rhr": str(entry["rhr"]),
        "hrv": "" if entry.get("hrv") is None else str(entry["hrv"]),
        "rem": "" if entry.get("rem") is None else str(entry["rem"]),
        "journal": "",
    }
    url = f"{base}?{urlencode(params)}"

    if os.environ.get("DRY_RUN") == "1":
        log(f"DRY_RUN — would GET {url}")
        return

    log(f"POST entry → {entry}")
    res = requests.get(url, timeout=30, allow_redirects=True)
    if not res.ok:
        log(f"ERROR Sheets API {res.status_code}: {res.text[:200]}")
        sys.exit(3)
    log(f"OK — Sheets API {res.status_code}")


def main() -> None:
    target_date = resolve_date()
    name = os.environ.get("SOMN_NAME", "").strip() or DEFAULT_NAME
    log(f"target_date={target_date} name={name!r}")

    try:
        client = login()
    except GarminConnectAuthenticationError as e:
        log(f"AUTH FAILED — check GARMIN_USERNAME / GARMIN_PASSWORD: {e}")
        sys.exit(2)
    except (GarminConnectConnectionError, GarminConnectTooManyRequestsError) as e:
        log(f"GARMIN UNREACHABLE: {e}")
        sys.exit(4)

    log("logged in")

    try:
        raw = client.get_sleep_data(target_date)
    except Exception as e:
        log(f"get_sleep_data failed: {e}")
        sys.exit(5)

    entry = extract_sleep(raw or {}, target_date)
    if entry is None:
        log(f"No sleep recorded for {target_date} yet — exiting cleanly.")
        return

    if entry.get("hrv") is None:
        entry["hrv"] = fetch_hrv(client, target_date)
    entry["rhr"] = fetch_rhr(client, target_date)

    log(
        f"pulled: ss={entry.get('ss')} rhr={entry.get('rhr')} "
        f"hrv={entry.get('hrv')} rem={entry.get('rem')}"
    )

    post_to_sheet(entry, name)


if __name__ == "__main__":
    main()
