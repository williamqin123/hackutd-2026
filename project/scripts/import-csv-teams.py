"""Import fictional teams from the original CSV into Alex's development database.

Run from project/: python3 scripts/import-csv-teams.py
Existing team names are skipped so rerunning does not add duplicates.
"""
import csv
import json
from pathlib import Path
import shutil
import subprocess

PROJECT = Path(__file__).resolve().parents[1]
SOURCE = PROJECT.parents[2] / "harvey_2017_houston_harris_flood_marks.csv"
DATABASE = "hack-utd-2026-y64f9"
CLI = shutil.which("spacetime") or str(Path.home() / ".local/bin/spacetime")


def execute(command, *args):
    result = subprocess.run(
        [CLI, command, "--no-config", "--server", "maincloud", *(["--"] if command == "call" else []), *args],
        capture_output=True, text=True, cwd=PROJECT,
    )
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout)
    return result.stdout


def existing_names():
    result = json.loads(execute("sql", "--format", "json", DATABASE, "SELECT name FROM rescue_team"))
    return {row[0] for row in result[0]["rows"]}


def main():
    teams = []
    with SOURCE.open(newline="") as file:
        for row in csv.DictReader(file):
            if row.get("demo_data_source") != "fictional_demo" or not row.get("demo_team_id"):
                continue
            name = row["demo_team_name"].strip()
            lat, lon = float(row["demo_team_lat"]), float(row["demo_team_lon"])
            capacity = int(row["demo_team_capacity"])
            medical, boat = row["demo_team_hasMedical"], row["demo_team_hasBoat"]
            if not name or not -90 <= lat <= 90 or not -180 <= lon <= 180 or not 1 <= capacity <= 4294967295:
                raise ValueError("Invalid team name, coordinates, or capacity")
            if medical not in ("true", "false") or boat not in ("true", "false"):
                raise ValueError("Team capabilities must be true or false")
            teams.append((name, lat, lon, capacity, medical == "true", boat == "true"))

    names = existing_names()
    inserted = 0
    for team in teams:
        if team[0] in names:
            print(f"Already exists: {team[0]}", flush=True)
            continue
        execute("call", DATABASE, "create_rescue_team", *(json.dumps(value) for value in team))
        names.add(team[0])
        inserted += 1
        print(f"Created: {team[0]}", flush=True)
    print(f"Imported {inserted} teams into {DATABASE}.", flush=True)
    print(execute("sql", DATABASE, "SELECT name, capacity, has_medical, has_boat, status FROM rescue_team"))


if __name__ == "__main__":
    main()
