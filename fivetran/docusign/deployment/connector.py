"""Fivetran Connector SDK connector for DocuSign eSignature metadata.

The connector authenticates with DocuSign's JWT grant on every sync. It copies
envelopes, recipients, envelope custom fields, and template metadata. It never
downloads or stores signed document contents.
"""

import base64
import json
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import quote

import requests
from cryptography.hazmat.primitives import serialization
from fivetran_connector_sdk import Connector
from fivetran_connector_sdk import Logging as log
from fivetran_connector_sdk import Operations as op


AUTH_SERVERS = {
    "demo": "account-d.docusign.com",
    "production": "account.docusign.com",
}

DEFAULT_INITIAL_SYNC_START = "2020-01-01T00:00:00Z"
DEFAULT_LOOKBACK_MINUTES = 15
REQUEST_TIMEOUT_SECONDS = 30
MAX_REQUEST_ATTEMPTS = 4
BATCH_SIZE = 100

RECIPIENT_TYPES = (
    "signers",
    "carbonCopies",
    "certifiedDeliveries",
    "inPersonSigners",
    "intermediaries",
    "agents",
    "editors",
    "witnesses",
    "notaries",
    "seals",
)


def schema(configuration: dict) -> List[Dict[str, Any]]:
    """Return the destination schema."""
    validate_configuration(configuration)

    return [
        {
            "table": "envelopes",
            "primary_key": ["envelope_id"],
            "columns": {
                "envelope_id": "STRING",
                "status": "STRING",
                "subject": "STRING",
                "created_datetime": "UTC_DATETIME",
                "sent_datetime": "UTC_DATETIME",
                "delivered_datetime": "UTC_DATETIME",
                "completed_datetime": "UTC_DATETIME",
                "declined_datetime": "UTC_DATETIME",
                "voided_datetime": "UTC_DATETIME",
                "status_changed_datetime": "UTC_DATETIME",
                "voided_reason": "STRING",
                "sender_user_id": "STRING",
                "sender_name": "STRING",
                "sender_email": "STRING",
                "template_id": "STRING",
                "contract_cycle_time_hours": "DOUBLE",
            },
        },
        {
            "table": "recipients",
            "primary_key": ["envelope_id", "recipient_id"],
            "columns": {
                "envelope_id": "STRING",
                "recipient_id": "STRING",
                "recipient_type": "STRING",
                "role_name": "STRING",
                "name": "STRING",
                "email": "STRING",
                "status": "STRING",
                "routing_order": "STRING",
                "recipient_user_id": "STRING",
                "sent_datetime": "UTC_DATETIME",
                "delivered_datetime": "UTC_DATETIME",
                "signed_datetime": "UTC_DATETIME",
                "declined_datetime": "UTC_DATETIME",
                "declined_reason": "STRING",
            },
        },
        {
            "table": "custom_fields",
            "primary_key": ["envelope_id", "field_id"],
            "columns": {
                "envelope_id": "STRING",
                "field_id": "STRING",
                "field_name": "STRING",
                "field_type": "STRING",
                "value": "STRING",
                "required": "BOOLEAN",
                "show": "BOOLEAN",
            },
        },
        {
            "table": "templates",
            "primary_key": ["template_id"],
            "columns": {
                "template_id": "STRING",
                "name": "STRING",
                "description": "STRING",
                "email_subject": "STRING",
                "created_datetime": "UTC_DATETIME",
                "last_modified_datetime": "UTC_DATETIME",
                "shared": "BOOLEAN",
                "folder_id": "STRING",
                "folder_name": "STRING",
                "owner_user_id": "STRING",
                "owner_name": "STRING",
            },
        },
    ]


def update(configuration: dict, state: Dict[str, Any]) -> None:
    """Sync DocuSign metadata and save the next incremental cursor."""
    validate_configuration(configuration)

    sync_started_at = utc_now_text()
    from_date = get_sync_start(configuration, state)
    client = DocusignClient(configuration)

    log.info(f"Syncing DocuSign envelopes changed since {from_date}")

    envelope_count = 0
    recipient_count = 0
    custom_field_count = 0

    for envelope in client.iter_envelopes(from_date):
        envelope_id = text(envelope.get("envelopeId"))
        if not envelope_id:
            log.warning("Skipping an envelope with no envelopeId")
            continue

        upsert_envelope(envelope)
        envelope_count += 1

        recipients = client.get_recipients(envelope_id)
        for recipient in recipients:
            upsert_recipient(envelope_id, recipient)
            recipient_count += 1

        custom_fields = client.get_custom_fields(envelope_id)
        for custom_field in custom_fields:
            upsert_custom_field(envelope_id, custom_field)
            custom_field_count += 1

    template_count = 0
    if boolean(configuration.get("sync_templates", "true")):
        for template in client.iter_templates():
            upsert_template(template)
            template_count += 1

    op.checkpoint({"last_sync_time": sync_started_at})

    log.info(
        "DocuSign sync complete: "
        f"{envelope_count} envelopes, "
        f"{recipient_count} recipients, "
        f"{custom_field_count} custom fields, "
        f"{template_count} templates"
    )


class DocusignClient:
    """Small DocuSign eSignature API client with JWT authentication."""

    def __init__(self, configuration: dict):
        self.configuration = configuration
        self.auth_server = AUTH_SERVERS[configuration["environment"]]
        self.access_token = ""
        self.account_api_url = ""

        self.refresh_access_token()
        self.account_api_url = self.discover_account_api_url()

    def refresh_access_token(self) -> None:
        """Create a fresh DocuSign access token with the JWT grant."""
        import jwt

        issued_at = int(time.time())
        claims = {
            "iss": self.configuration["integration_key"],
            "sub": self.configuration["user_id"],
            "aud": self.auth_server,
            "iat": issued_at - 60,
            "exp": issued_at + 3600,
            "scope": "signature impersonation",
        }

        assertion = jwt.encode(
            claims,
            load_private_key(self.configuration["rsa_private_key_base64"]),
            algorithm="RS256",
        )

        response = requests.post(
            f"https://{self.auth_server}/oauth/token",
            data={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": assertion,
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

        if not response.ok:
            raise RuntimeError(format_api_error("DocuSign OAuth", response))

        token = response.json().get("access_token")
        if not token:
            raise RuntimeError("DocuSign OAuth response did not include an access token")

        self.access_token = token

    def discover_account_api_url(self) -> str:
        """Resolve the account's regional API URL from DocuSign userinfo."""
        response = requests.get(
            f"https://{self.auth_server}/oauth/userinfo",
            headers=self.headers(),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

        if not response.ok:
            raise RuntimeError(format_api_error("DocuSign userinfo", response))

        target_account_id = self.configuration["account_id"]
        accounts = response.json().get("accounts", [])

        for account in accounts:
            if account.get("account_id") != target_account_id:
                continue

            base_uri = text(account.get("base_uri")).rstrip("/")
            if not base_uri:
                break

            return (
                f"{base_uri}/restapi/v2.1/accounts/"
                f"{quote(target_account_id, safe='')}"
            )

        raise RuntimeError(
            "The configured DocuSign user does not have access to account_id "
            f"{target_account_id}"
        )

    def headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
        }

    def get(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """GET a DocuSign API resource with bounded retries."""
        url = f"{self.account_api_url}{path}"
        refreshed_token = False

        for attempt in range(MAX_REQUEST_ATTEMPTS):
            response = requests.get(
                url,
                headers=self.headers(),
                params=params,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )

            if response.ok:
                return response.json()

            if response.status_code == 401 and not refreshed_token:
                self.refresh_access_token()
                refreshed_token = True
                continue

            if response.status_code == 429 or response.status_code >= 500:
                if attempt < MAX_REQUEST_ATTEMPTS - 1:
                    time.sleep(retry_delay_seconds(response, attempt))
                    continue

            raise RuntimeError(format_api_error("DocuSign API", response))

        raise RuntimeError("DocuSign API request exhausted all retry attempts")

    def iter_pages(
        self,
        path: str,
        item_key: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> Iterable[Dict[str, Any]]:
        """Yield objects from an offset-paginated DocuSign endpoint."""
        page_params = dict(params or {})
        page_params["count"] = BATCH_SIZE
        start_position = 0

        while True:
            page_params["start_position"] = start_position
            data = self.get(path, page_params)
            items = data.get(item_key, [])

            if not items:
                return

            yield from items

            start_position += len(items)
            if len(items) < BATCH_SIZE:
                return

    def iter_envelopes(self, from_date: str) -> Iterable[Dict[str, Any]]:
        return self.iter_pages(
            "/envelopes",
            "envelopes",
            {"from_date": from_date},
        )

    def get_recipients(self, envelope_id: str) -> List[Dict[str, Any]]:
        safe_envelope_id = quote(envelope_id, safe="")
        data = self.get(f"/envelopes/{safe_envelope_id}/recipients")
        recipients = []

        for recipient_type in RECIPIENT_TYPES:
            for recipient in data.get(recipient_type, []):
                normalized_recipient = dict(recipient)
                normalized_recipient["recipient_type"] = recipient_type
                recipients.append(normalized_recipient)

        return recipients

    def get_custom_fields(self, envelope_id: str) -> List[Dict[str, Any]]:
        safe_envelope_id = quote(envelope_id, safe="")
        data = self.get(f"/envelopes/{safe_envelope_id}/custom_fields")
        fields = []

        for field in data.get("textCustomFields", []):
            normalized_field = dict(field)
            normalized_field["field_type"] = "text"
            fields.append(normalized_field)

        for field in data.get("listCustomFields", []):
            normalized_field = dict(field)
            normalized_field["field_type"] = "list"
            fields.append(normalized_field)

        return fields

    def iter_templates(self) -> Iterable[Dict[str, Any]]:
        return self.iter_pages("/templates", "envelopeTemplates")


def validate_configuration(configuration: dict) -> None:
    """Fail early with a clear message for invalid configuration."""
    required_keys = (
        "environment",
        "integration_key",
        "user_id",
        "account_id",
        "rsa_private_key_base64",
    )

    for key in required_keys:
        if text(configuration.get(key)):
            continue
        raise ValueError(f"Missing required configuration value: {key}")

    environment = configuration["environment"]
    if environment not in AUTH_SERVERS:
        raise ValueError("environment must be either 'demo' or 'production'")

    load_private_key(configuration["rsa_private_key_base64"])

    initial_sync_start = configuration.get(
        "initial_sync_start",
        DEFAULT_INITIAL_SYNC_START,
    )
    parse_utc_datetime(initial_sync_start, "initial_sync_start")

    lookback_minutes = configuration.get(
        "lookback_minutes",
        str(DEFAULT_LOOKBACK_MINUTES),
    )
    try:
        lookback_minutes_value = int(lookback_minutes)
    except ValueError as exc:
        raise ValueError("lookback_minutes must be a whole number") from exc

    if lookback_minutes_value < 0:
        raise ValueError("lookback_minutes cannot be negative")


def decode_private_key(encoded_key: str) -> str:
    """Decode the one-line base64 PEM used in Fivetran configuration."""
    try:
        private_key = base64.b64decode(encoded_key).decode("utf-8").strip()
    except (ValueError, UnicodeDecodeError) as exc:
        raise ValueError("rsa_private_key_base64 is not valid base64 PEM data") from exc

    valid_headers = (
        "-----BEGIN PRIVATE KEY-----",
        "-----BEGIN RSA PRIVATE KEY-----",
    )
    if not private_key.startswith(valid_headers):
        raise ValueError(
            "rsa_private_key_base64 must decode to a PEM private key"
        )

    return private_key


def load_private_key(encoded_key: str):
    """Load and cryptographically validate the configured RSA private key."""
    private_key = decode_private_key(encoded_key)

    try:
        return serialization.load_pem_private_key(
            private_key.encode("utf-8"),
            password=None,
        )
    except (TypeError, ValueError) as exc:
        raise ValueError(
            "rsa_private_key_base64 does not contain a valid unencrypted "
            "PEM private key"
        ) from exc


def get_sync_start(configuration: dict, state: Dict[str, Any]) -> str:
    """Return the initial cursor or a lookback-adjusted incremental cursor."""
    last_sync_time = text(state.get("last_sync_time"))
    if not last_sync_time:
        return configuration.get(
            "initial_sync_start",
            DEFAULT_INITIAL_SYNC_START,
        )

    last_sync_datetime = parse_utc_datetime(last_sync_time, "last_sync_time")
    lookback_minutes = int(
        configuration.get(
            "lookback_minutes",
            str(DEFAULT_LOOKBACK_MINUTES),
        )
    )
    adjusted_datetime = last_sync_datetime - timedelta(minutes=lookback_minutes)
    return utc_datetime_text(adjusted_datetime)


def upsert_envelope(envelope: Dict[str, Any]) -> None:
    envelope_id = text(envelope.get("envelopeId"))
    sender = envelope.get("sender") or {}

    op.upsert(
        "envelopes",
        {
            "envelope_id": envelope_id,
            "status": text(envelope.get("status")),
            "subject": text(envelope.get("emailSubject")),
            "created_datetime": timestamp(envelope.get("createdDateTime")),
            "sent_datetime": timestamp(envelope.get("sentDateTime")),
            "delivered_datetime": timestamp(envelope.get("deliveredDateTime")),
            "completed_datetime": timestamp(envelope.get("completedDateTime")),
            "declined_datetime": timestamp(envelope.get("declinedDateTime")),
            "voided_datetime": timestamp(envelope.get("voidedDateTime")),
            "status_changed_datetime": timestamp(
                envelope.get("statusChangedDateTime")
            ),
            "voided_reason": text(envelope.get("voidedReason")),
            "sender_user_id": text(sender.get("userId")),
            "sender_name": text(sender.get("userName")),
            "sender_email": text(sender.get("email")),
            "template_id": text(envelope.get("templateId")),
            "contract_cycle_time_hours": contract_cycle_time_hours(envelope),
        },
    )


def upsert_recipient(
    envelope_id: str,
    recipient: Dict[str, Any],
) -> None:
    recipient_id = text(recipient.get("recipientId"))
    if not recipient_id:
        log.warning(f"Skipping recipient with no recipientId in {envelope_id}")
        return

    op.upsert(
        "recipients",
        {
            "envelope_id": envelope_id,
            "recipient_id": recipient_id,
            "recipient_type": text(recipient.get("recipient_type")),
            "role_name": text(recipient.get("roleName")),
            "name": text(recipient.get("name")),
            "email": text(recipient.get("email")),
            "status": text(recipient.get("status")),
            "routing_order": text(recipient.get("routingOrder")),
            "recipient_user_id": text(recipient.get("userId")),
            "sent_datetime": timestamp(recipient.get("sentDateTime")),
            "delivered_datetime": timestamp(recipient.get("deliveredDateTime")),
            "signed_datetime": timestamp(recipient.get("signedDateTime")),
            "declined_datetime": timestamp(recipient.get("declinedDateTime")),
            "declined_reason": text(recipient.get("declinedReason")),
        },
    )


def upsert_custom_field(
    envelope_id: str,
    custom_field: Dict[str, Any],
) -> None:
    field_name = text(custom_field.get("name"))
    field_id = text(custom_field.get("fieldId"))
    if not field_id:
        field_id = f"{custom_field.get('field_type', 'unknown')}:{field_name}"

    op.upsert(
        "custom_fields",
        {
            "envelope_id": envelope_id,
            "field_id": field_id,
            "field_name": field_name,
            "field_type": text(custom_field.get("field_type")),
            "value": text(custom_field.get("value")),
            "required": boolean(custom_field.get("required", False)),
            "show": boolean(custom_field.get("show", False)),
        },
    )


def upsert_template(template: Dict[str, Any]) -> None:
    template_id = text(template.get("templateId"))
    if not template_id:
        log.warning("Skipping a template with no templateId")
        return

    owner = template.get("owner") or {}

    op.upsert(
        "templates",
        {
            "template_id": template_id,
            "name": text(template.get("name")),
            "description": text(template.get("description")),
            "email_subject": text(template.get("emailSubject")),
            "created_datetime": timestamp(template.get("created")),
            "last_modified_datetime": timestamp(template.get("lastModified")),
            "shared": boolean(template.get("shared", False)),
            "folder_id": text(template.get("folderId")),
            "folder_name": text(template.get("folderName")),
            "owner_user_id": text(owner.get("userId")),
            "owner_name": text(owner.get("userName")),
        },
    )


def contract_cycle_time_hours(envelope: Dict[str, Any]) -> Optional[float]:
    sent_text = text(envelope.get("sentDateTime"))
    completed_text = text(envelope.get("completedDateTime"))

    if not sent_text or not completed_text:
        return None

    try:
        sent_at = parse_utc_datetime(sent_text, "sentDateTime")
        completed_at = parse_utc_datetime(completed_text, "completedDateTime")
    except ValueError:
        return None

    return (completed_at - sent_at).total_seconds() / 3600


def retry_delay_seconds(response: requests.Response, attempt: int) -> int:
    retry_after = response.headers.get("Retry-After")
    if retry_after:
        try:
            return min(max(int(retry_after), 1), 60)
        except ValueError:
            pass

    return min(2**attempt, 30)


def format_api_error(label: str, response: requests.Response) -> str:
    response_text = response.text.strip()
    if len(response_text) > 500:
        response_text = f"{response_text[:500]}..."

    return f"{label} returned HTTP {response.status_code}: {response_text}"


def parse_utc_datetime(value: str, field_name: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (AttributeError, ValueError) as exc:
        raise ValueError(
            f"{field_name} must be an ISO-8601 timestamp, for example "
            "2024-01-01T00:00:00Z"
        ) from exc

    if parsed.tzinfo is None:
        raise ValueError(f"{field_name} must include a timezone")

    return parsed.astimezone(timezone.utc)


def utc_now_text() -> str:
    return utc_datetime_text(datetime.now(timezone.utc))


def utc_datetime_text(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(
        timespec="seconds"
    ).replace("+00:00", "Z")


def text(value: Any) -> str:
    if value is None:
        return ""
    return str(value)


def timestamp(value: Any) -> Optional[str]:
    value_text = text(value)
    if not value_text:
        return None
    return value_text


def boolean(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return text(value).strip().lower() in {"1", "true", "yes", "y"}


connector = Connector(update=update, schema=schema)


if __name__ == "__main__":
    with open("configuration.json", "r", encoding="utf-8") as configuration_file:
        local_configuration = json.load(configuration_file)

    connector.debug(configuration=local_configuration)
