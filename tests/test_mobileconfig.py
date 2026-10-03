import plistlib
import ssl
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from tools.build_mobileconfig import build_profile, load_certificate_bytes

ROOT_PEM = b"""-----BEGIN CERTIFICATE-----
MIIBqTCCAU+gAwIBAgIUFa6rVlUear5k1HiKhkuZdaT2d+AwCgYIKoZIzj0EAwIw
ITEfMB0GA1UEAwwWTW9iaWxlY29uZmlnIFRlc3Qgcm9vdDAgFw0yNjEwMDMwNDMz
MzJaGA8yMTI2MDkwOTA0MzMzMlowITEfMB0GA1UEAwwWTW9iaWxlY29uZmlnIFRl
c3Qgcm9vdDBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABKDabWmCPZ0lExiniyQC
2q+IhYrsVAXeFT3aUVDCGbm9NinJ53AG4JPrVV6m08aOgRH++JnqLpN2Fy8U0dqS
QMujYzBhMB0GA1UdDgQWBBTVdExH4kmwPWS1R20swYfz0FrxPzAfBgNVHSMEGDAW
gBTVdExH4kmwPWS1R20swYfz0FrxPzAPBgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB
/wQEAwIBBjAKBggqhkjOPQQDAgNIADBFAiA5OtgQ3THWwCj7a6xeTak2+ZiWYOen
7qZokaRnFGgJOwIhAN/Sqwu7v5BxuVtxPFVlKOUjZWibjjNh8DGqSvjSqvF+
-----END CERTIFICATE-----
"""
LEAF_PEM = b"""-----BEGIN CERTIFICATE-----
MIIBpTCCAUygAwIBAgIUTEhPA6GAyDRnVYaVclDsJt0no1wwCgYIKoZIzj0EAwIw
ITEfMB0GA1UEAwwWTW9iaWxlY29uZmlnIFRlc3QgbGVhZjAgFw0yNjEwMDMwNDMz
MzNaGA8yMTI2MDkwOTA0MzMzM1owITEfMB0GA1UEAwwWTW9iaWxlY29uZmlnIFRl
c3QgbGVhZjBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABGE3RNAjhWeOSo8lF7tW
y9fAGbls4lTDe+d/qWsBeop9VWbobeAV6wu1GibhTlWZ7vag7LzgwoMhG6QIT5Uj
4aujYDBeMB0GA1UdDgQWBBQuUz6Z4mMGLWJGHSWJOLBcQOeaoDAfBgNVHSMEGDAW
gBQuUz6Z4mMGLWJGHSWJOLBcQOeaoDAMBgNVHRMBAf8EAjAAMA4GA1UdDwEB/wQE
AwIHgDAKBggqhkjOPQQDAgNHADBEAiAlNTtY8PJpTV2JoyNuzLBbHCPlL8hAZf/0
tPMS77uPlgIgexG+AbcIS9iXnV4MepxJ5LmELZyxC+cfkVcd5lNu62k=
-----END CERTIFICATE-----
"""
ROOT_DER = ssl.PEM_cert_to_DER_cert(ROOT_PEM.decode("ascii"))
PRIVATE_PEM = b"-----BEGIN PRIVATE KEY-----\nc2VjcmV0\n-----END PRIVATE KEY-----\n"
SCRIPT_PATH = Path(__file__).resolve().parents[1] / "tools" / "build_mobileconfig.py"
INVALID_INPUTS = {
    "empty": b"",
    "html": b"<html>certificate download failed</html>",
    "private": PRIVATE_PEM,
    "private-before-certificate": PRIVATE_PEM + ROOT_PEM,
    "private-after-certificate": ROOT_PEM + PRIVATE_PEM,
    "multiple-pem": ROOT_PEM + ROOT_PEM,
    "multiple-der": ROOT_DER + ROOT_DER,
    "trailing-der-data": ROOT_DER + b"secret",
    "trailing-pem-data": ROOT_PEM + b"secret",
    "invalid-base64": ROOT_PEM.replace(b"MIIBq", b"!MIIBq", 1),
    "not-x509": b"-----BEGIN CERTIFICATE-----\nc2VjcmV0\n-----END CERTIFICATE-----",
    "leaf-certificate": LEAF_PEM,
    "non-root-ca": ROOT_DER.replace(
        b"Mobileconfig Test root", b"Mobileconfig Test next", 1
    ),
}


class MobileconfigTests(unittest.TestCase):
    def test_accepts_one_pem_or_der_root_certificate(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            cert = Path(directory) / "root.cer"
            for raw in (
                ROOT_PEM,
                ROOT_DER,
                b"\r\n " + ROOT_PEM.replace(b"\n", b"\r\n") + b" \t",
            ):
                with self.subTest(raw=raw[:30]):
                    cert.write_bytes(raw)
                    self.assertEqual(load_certificate_bytes(cert), ROOT_DER)
                    profile = plistlib.loads(plistlib.dumps(build_profile(cert)))
                    self.assertEqual(profile["PayloadType"], "Configuration")
                    self.assertNotIn("PayloadRemovalDisallowed", profile)
                    self.assertEqual(len(profile["PayloadContent"]), 1)
                    payload = profile["PayloadContent"][0]
                    self.assertEqual(payload["PayloadType"], "com.apple.security.root")
                    self.assertEqual(payload["PayloadContent"], ROOT_DER)
                    self.assertEqual(payload["PayloadCertificateFileName"], cert.name)

    def test_rejects_non_certificate_data(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            cert = Path(directory) / "input.cer"
            for name, raw in INVALID_INPUTS.items():
                with self.subTest(name=name):
                    cert.write_bytes(raw)
                    with self.assertRaises(ValueError):
                        load_certificate_bytes(cert)

    def test_cli_writes_certificate_only_profile(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            cert = Path(directory) / "root.cer"
            cert.write_bytes(ROOT_DER)
            result = subprocess.run(
                [sys.executable, "-B", str(SCRIPT_PATH), str(cert)],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            profile = plistlib.loads(cert.with_suffix(".mobileconfig").read_bytes())
            self.assertEqual(profile["PayloadContent"][0]["PayloadContent"], ROOT_DER)

    def test_cli_does_not_create_or_overwrite_output_for_invalid_input(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            cert = Path(directory) / "input.cer"
            output = Path(directory) / "output.mobileconfig"
            for name, raw in INVALID_INPUTS.items():
                for existing in (False, True):
                    with self.subTest(name=name, existing=existing):
                        cert.write_bytes(raw)
                        if existing:
                            output.write_bytes(b"keep existing output")
                        else:
                            output.unlink(missing_ok=True)
                        result = subprocess.run(
                            [
                                sys.executable,
                                "-B",
                                str(SCRIPT_PATH),
                                str(cert),
                                "-o",
                                str(output),
                            ],
                            capture_output=True,
                            text=True,
                            check=False,
                        )
                        self.assertNotEqual(result.returncode, 0)
                        self.assertIn("Error:", result.stderr)
                        self.assertNotIn("Traceback", result.stderr)
                        self.assertEqual(result.stdout, "")
                        if existing:
                            self.assertEqual(
                                output.read_bytes(), b"keep existing output"
                            )
                        else:
                            self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
