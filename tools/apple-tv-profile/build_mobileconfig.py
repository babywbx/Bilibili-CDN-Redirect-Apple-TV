#!/usr/bin/env python3
"""
Build a certificate-only .mobileconfig for Apple TV profile import.

Default branding is hard-coded for Babywbx.
"""

from __future__ import annotations

import argparse
import plistlib
import sys
import uuid
from pathlib import Path
import base64


DEFAULT_CERT_NAME = "Babywbx Surge Root CA"
DEFAULT_PROFILE_NAME = "Babywbx Surge MITM Profile"
DEFAULT_PROFILE_DESCRIPTION = "Root certificate profile for Bilibili CDN Redirect."
DEFAULT_CERT_DESCRIPTION = "Installs the Babywbx Surge root CA certificate."
DEFAULT_ORGANIZATION = "Babywbx"
DEFAULT_PROFILE_ID = "com.babywbx.surge.rootca.profile"
DEFAULT_PAYLOAD_ID = "com.babywbx.surge.rootca.cert"


def load_certificate_bytes(cert_path: Path) -> bytes:
    raw = cert_path.read_bytes()
    if b"-----BEGIN CERTIFICATE-----" not in raw:
        return raw

    pem_text = raw.decode("utf-8")
    body = "".join(
        line.strip()
        for line in pem_text.splitlines()
        if line and not line.startswith("-----")
    )
    return base64.b64decode(body)


def build_profile(cert_path: Path) -> dict[str, object]:
    certificate_bytes = load_certificate_bytes(cert_path)

    cert_payload = {
        "PayloadCertificateFileName": cert_path.name,
        "PayloadContent": certificate_bytes,
        "PayloadDescription": DEFAULT_CERT_DESCRIPTION,
        "PayloadDisplayName": DEFAULT_CERT_NAME,
        "PayloadIdentifier": DEFAULT_PAYLOAD_ID,
        "PayloadOrganization": DEFAULT_ORGANIZATION,
        "PayloadType": "com.apple.security.root",
        "PayloadUUID": str(uuid.uuid4()).upper(),
        "PayloadVersion": 1,
    }

    profile_payload = {
        "PayloadContent": [cert_payload],
        "PayloadDescription": DEFAULT_PROFILE_DESCRIPTION,
        "PayloadDisplayName": DEFAULT_PROFILE_NAME,
        "PayloadIdentifier": DEFAULT_PROFILE_ID,
        "PayloadOrganization": DEFAULT_ORGANIZATION,
        "PayloadRemovalDisallowed": False,
        "PayloadType": "Configuration",
        "PayloadUUID": str(uuid.uuid4()).upper(),
        "PayloadVersion": 1,
    }

    return profile_payload


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a Babywbx-branded certificate-only .mobileconfig."
    )
    parser.add_argument(
        "certificate",
        help="Path to the exported Surge root certificate (.cer/.crt/.der/.pem).",
    )
    parser.add_argument(
        "-o",
        "--output",
        help="Output .mobileconfig path. Defaults to <certificate stem>.mobileconfig",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    cert_path = Path(args.certificate).expanduser().resolve()

    if not cert_path.is_file():
        print(f"Certificate file not found: {cert_path}", file=sys.stderr)
        return 1

    output_path = (
        Path(args.output).expanduser().resolve()
        if args.output
        else cert_path.with_suffix(".mobileconfig")
    )

    profile_payload = build_profile(cert_path)
    plist_bytes = plistlib.dumps(profile_payload, fmt=plistlib.FMT_XML, sort_keys=False)
    output_path.write_bytes(plist_bytes)

    print(f"Generated: {output_path}")
    print(f"Profile name: {DEFAULT_PROFILE_NAME}")
    print(f"Organization: {DEFAULT_ORGANIZATION}")
    print(f"Certificate name: {DEFAULT_CERT_NAME}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
