import base64
import importlib
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa


PROJECT_DIRECTORY = Path(__file__).resolve().parents[1]
DEPLOYMENT_DIRECTORY = PROJECT_DIRECTORY / "deployment"
sys.path.insert(0, str(DEPLOYMENT_DIRECTORY))


class FakeConnector:
    def __init__(self, update, schema):
        self.update = update
        self.schema = schema


class FakeOperations:
    upserts = []
    checkpoints = []

    @classmethod
    def reset(cls):
        cls.upserts = []
        cls.checkpoints = []

    @classmethod
    def upsert(cls, table, data):
        cls.upserts.append((table, data))

    @classmethod
    def checkpoint(cls, state):
        cls.checkpoints.append(state)


class FakeLogging:
    @staticmethod
    def info(message):
        return None

    @staticmethod
    def warning(message):
        return None


fake_sdk = types.ModuleType("fivetran_connector_sdk")
fake_sdk.Connector = FakeConnector
fake_sdk.Operations = FakeOperations
fake_sdk.Logging = FakeLogging
sys.modules["fivetran_connector_sdk"] = fake_sdk

connector = importlib.import_module("connector")


def private_key_base64():
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    private_key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    return base64.b64encode(private_key_pem).decode("ascii")


def valid_configuration():
    return {
        "environment": "production",
        "integration_key": "integration-key",
        "user_id": "user-id",
        "account_id": "account-id",
        "rsa_private_key_base64": private_key_base64(),
        "initial_sync_start": "2024-01-01T00:00:00Z",
        "lookback_minutes": "15",
        "sync_templates": "true",
    }


class FakeResponse:
    def __init__(self, status_code, payload, text=""):
        self.status_code = status_code
        self.payload = payload
        self.text = text
        self.headers = {}
        self.ok = 200 <= status_code < 300

    def json(self):
        return self.payload


class ConnectorConfigurationTests(unittest.TestCase):
    def test_valid_configuration_is_accepted(self):
        connector.validate_configuration(valid_configuration())

    def test_missing_value_has_clear_error(self):
        configuration = valid_configuration()
        configuration["account_id"] = ""

        with self.assertRaisesRegex(
            ValueError,
            "Missing required configuration value: account_id",
        ):
            connector.validate_configuration(configuration)

    def test_incremental_cursor_includes_lookback(self):
        sync_start = connector.get_sync_start(
            valid_configuration(),
            {"last_sync_time": "2024-06-01T12:00:00Z"},
        )

        self.assertEqual(sync_start, "2024-06-01T11:45:00Z")

    def test_initial_cursor_uses_configuration(self):
        sync_start = connector.get_sync_start(valid_configuration(), {})

        self.assertEqual(sync_start, "2024-01-01T00:00:00Z")


class AuthenticationTests(unittest.TestCase):
    def test_jwt_authentication_discovers_regional_api_url(self):
        encoded_claims = {}

        fake_jwt = types.ModuleType("jwt")

        def encode(claims, private_key, algorithm):
            encoded_claims.update(claims)
            self.assertEqual(private_key.key_size, 2048)
            self.assertEqual(algorithm, "RS256")
            return "signed-assertion"

        fake_jwt.encode = encode

        token_response = FakeResponse(
            200,
            {"access_token": "temporary-token"},
        )
        userinfo_response = FakeResponse(
            200,
            {
                "accounts": [
                    {
                        "account_id": "account-id",
                        "base_uri": "https://na4.docusign.net",
                    }
                ]
            },
        )

        with patch.dict(sys.modules, {"jwt": fake_jwt}):
            with patch.object(
                connector.requests,
                "post",
                return_value=token_response,
            ) as post:
                with patch.object(
                    connector.requests,
                    "get",
                    return_value=userinfo_response,
                ):
                    client = connector.DocusignClient(valid_configuration())

        self.assertEqual(encoded_claims["scope"], "signature impersonation")
        self.assertEqual(encoded_claims["aud"], "account.docusign.com")
        self.assertEqual(
            client.account_api_url,
            "https://na4.docusign.net/restapi/v2.1/accounts/account-id",
        )
        self.assertEqual(
            post.call_args.kwargs["data"]["assertion"],
            "signed-assertion",
        )


class SyncTests(unittest.TestCase):
    def setUp(self):
        FakeOperations.reset()

    def test_update_writes_metadata_tables_only(self):
        class FakeClient:
            def __init__(self, configuration):
                pass

            def iter_envelopes(self, from_date):
                return [
                    {
                        "envelopeId": "envelope-1",
                        "status": "completed",
                        "emailSubject": "Mentorship agreement",
                        "sentDateTime": "2024-01-01T00:00:00Z",
                        "completedDateTime": "2024-01-01T01:00:00Z",
                    }
                ]

            def get_recipients(self, envelope_id):
                return [
                    {
                        "recipientId": "recipient-1",
                        "recipient_type": "signers",
                        "email": "buyer@example.com",
                        "status": "completed",
                    }
                ]

            def get_custom_fields(self, envelope_id):
                return [
                    {
                        "fieldId": "field-1",
                        "name": "program",
                        "field_type": "text",
                        "value": "mentorship",
                    }
                ]

            def iter_templates(self):
                return [
                    {
                        "templateId": "template-1",
                        "name": "Mentorship",
                    }
                ]

        with patch.object(connector, "DocusignClient", FakeClient):
            connector.update(valid_configuration(), {})

        tables = [table for table, data in FakeOperations.upserts]

        self.assertEqual(
            tables,
            ["envelopes", "recipients", "custom_fields", "templates"],
        )
        self.assertNotIn("documents", tables)
        self.assertNotIn("document_contents", tables)
        self.assertEqual(len(FakeOperations.checkpoints), 1)


if __name__ == "__main__":
    unittest.main()
