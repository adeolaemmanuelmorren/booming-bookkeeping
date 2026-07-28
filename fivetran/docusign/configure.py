"""Create an ignored local configuration.json without exposing credentials."""

import base64
import json
from pathlib import Path
from urllib.parse import quote


OUTPUT_PATH = Path(__file__).with_name("deployment") / "configuration.json"


def prompt(label: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""

    while True:
        value = input(f"{label}{suffix}: ").strip()
        if value:
            return value
        if default:
            return default

        print(f"{label} is required.")


def read_private_key() -> str:
    while True:
        private_key_path = Path(
            prompt("Path to the DocuSign RSA private key PEM")
        ).expanduser()

        try:
            private_key = private_key_path.read_bytes()
        except OSError as exc:
            print(f"Could not read that file: {exc}")
            continue

        if b"-----BEGIN" not in private_key:
            print("That file does not look like a PEM private key.")
            continue

        return base64.b64encode(private_key).decode("ascii")


def consent_url(
    environment: str,
    integration_key: str,
    redirect_uri: str,
) -> str:
    auth_server = (
        "account.docusign.com"
        if environment == "production"
        else "account-d.docusign.com"
    )

    return (
        f"https://{auth_server}/oauth/auth"
        "?response_type=code"
        "&scope=signature%20impersonation"
        f"&client_id={quote(integration_key, safe='')}"
        f"&redirect_uri={quote(redirect_uri, safe='')}"
    )


def main() -> None:
    print("Create local DocuSign connector configuration")
    print("This writes configuration.json, which Git is configured to ignore.")
    print()

    environment = prompt("Environment (production or demo)", "production")
    if environment not in {"production", "demo"}:
        raise SystemExit("Environment must be 'production' or 'demo'.")

    integration_key = prompt("DocuSign Integration Key")
    user_id = prompt("DocuSign API User ID")
    account_id = prompt("DocuSign Account ID")
    private_key_base64 = read_private_key()
    initial_sync_start = prompt(
        "Initial history start in UTC",
        "2020-01-01T00:00:00Z",
    )

    configuration = {
        "environment": environment,
        "integration_key": integration_key,
        "user_id": user_id,
        "account_id": account_id,
        "rsa_private_key_base64": private_key_base64,
        "initial_sync_start": initial_sync_start,
        "lookback_minutes": "15",
        "sync_templates": "true",
    }

    OUTPUT_PATH.write_text(
        json.dumps(configuration, indent=2) + "\n",
        encoding="utf-8",
    )

    print()
    print(f"Wrote {OUTPUT_PATH}")
    print("The private key was encoded onto one line; its contents were not printed.")
    print()

    redirect_uri = input(
        "Configured DocuSign redirect URI "
        "(leave blank if JWT consent is already granted): "
    ).strip()

    if not redirect_uri:
        return

    print()
    print("Open this URL while signed in as the configured API user:")
    print(consent_url(environment, integration_key, redirect_uri))


if __name__ == "__main__":
    main()
