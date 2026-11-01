#!/usr/bin/env python3
"""Parse CanSat RX serial frames into a clean telemetry CSV."""

import argparse
import csv
import math
import re
import sys
from pathlib import Path


CSV_COLUMNS = [
    "esp_ms",
    "packet_length",
    "team_id",
    "time_s",
    "packet_count",
    "altitude_m",
    "pressure_pa",
    "temp_c",
    "volt_v",
    "gnss_time",
    "latitude",
    "longitude",
    "gnss_alt_m",
    "sats",
    "ax",
    "ay",
    "az",
    "roll",
    "pitch",
    "spin_rate",
    "flight_state",
    "mx",
    "my",
    "mz",
    "rssi_dbm",
    "snr_db",
]

_RX_PREFIX = re.compile(r"(?:^|\s)RX,")
_NUMERIC_COLUMNS = {
    "esp_ms",
    "packet_length",
    "time_s",
    "packet_count",
    "altitude_m",
    "pressure_pa",
    "temp_c",
    "volt_v",
    "latitude",
    "longitude",
    "gnss_alt_m",
    "sats",
    "ax",
    "ay",
    "az",
    "roll",
    "pitch",
    "spin_rate",
    "mx",
    "my",
    "mz",
    "rssi_dbm",
    "snr_db",
}


def _is_finite_number(value):
    try:
        return math.isfinite(float(value))
    except ValueError:
        return False


def parse_rx(line, now):
    """Return one normalized telemetry record, or None for noise/malformed input."""
    del now  # Kept in the parser signature for callers that track receive time.

    match = _RX_PREFIX.search(line)
    if match is None:
        return None

    frame = line[match.start():].strip()
    if frame.startswith(","):
        frame = frame[1:]
    fields = [field.strip() for field in frame.split(",")]
    if len(fields) != 21 or fields[0] != "RX":
        return None

    record = dict(zip(CSV_COLUMNS[:14], fields[1:15]))
    acceleration = [value.strip() for value in fields[15].split(";")]
    record["spin_rate"] = fields[16]
    record["flight_state"] = fields[17]
    magnetometer = [value.strip() for value in fields[18].split(";")]
    record["rssi_dbm"] = fields[19]
    record["snr_db"] = fields[20]

    if len(acceleration) != 5 or len(magnetometer) != 3:
        return None

    record.update(zip(("ax", "ay", "az", "roll", "pitch"), acceleration))
    record.update(zip(("mx", "my", "mz"), magnetometer))

    if any(not value for value in record.values()):
        return None
    if any(
        not _is_finite_number(record[column])
        for column in _NUMERIC_COLUMNS
    ):
        return None

    return {column: record[column] for column in CSV_COLUMNS}


def write_log(lines, csv_path, log_path):
    with csv_path.open("w", encoding="utf-8", newline="") as csv_file, log_path.open(
        "w", encoding="utf-8", newline=""
    ) as log_file:
        writer = csv.DictWriter(
            csv_file,
            fieldnames=CSV_COLUMNS,
            extrasaction="raise",
            lineterminator="\r\n",
        )
        writer.writeheader()

        for line in lines:
            if not line.strip():
                continue

            record = parse_rx(line, None)
            if record is None:
                log_file.write(line.rstrip("\r\n") + "\n")
                continue

            writer.writerow(record)


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument(
        "--replay",
        type=Path,
        metavar="CAPTURED_TXT",
        help="parse a captured serial text file instead of opening a serial port",
    )
    source.add_argument(
        "--port",
        help="serial port for live logging (for example COM8 or /dev/ttyUSB0)",
    )
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--output", type=Path, default=Path("mission_log.csv"))
    parser.add_argument(
        "--log",
        type=Path,
        help="noise/debug log path (defaults to mission_log.log beside the CSV)",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    log_path = args.log or args.output.with_suffix(".log")

    if args.replay is not None:
        with args.replay.open("r", encoding="utf-8-sig") as capture:
            write_log(capture, args.output, log_path)
        return

    try:
        import serial
    except ImportError:
        print(
            "Live serial logging requires pyserial; install it with "
            "`python -m pip install pyserial`.",
            file=sys.stderr,
        )
        return 1

    with serial.Serial(args.port, args.baud, timeout=1) as connection:
        def serial_lines():
            while True:
                yield connection.readline().decode("utf-8", errors="replace")

        try:
            write_log(serial_lines(), args.output, log_path)
        except KeyboardInterrupt:
            return 0

    return 0


if __name__ == "__main__":
    raise SystemExit(main() or 0)
