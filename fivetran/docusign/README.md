# DocuSign to Fivetran

This Connector SDK project syncs DocuSign eSignature metadata into the existing
Fivetran destination.

It copies:

- envelopes and their status timestamps;
- recipients, including signer email and signed timestamp;
- envelope custom fields;
- template metadata.

It does **not** request, download, or store signed contracts or other document
contents.

## Where secrets go

DocuSign values go in:

```text
fivetran/docusign/deployment/configuration.json
```

That file is ignored by Git. The included setup helper reads the DocuSign PEM
private key and writes it as a one-line base64 value, which avoids JSON newline
problems.

Fivetran's API key and secret do not go in any file. Export them in the shell
only for the deployment command.

## 1. Prepare DocuSign

In DocuSign Admin or **Apps and Keys**, create or select an integration that:

1. belongs to the production account you want to sync;
2. has an RSA key pair for JWT Grant;
3. has at least one configured redirect URI;
4. is approved for production if it was created in the developer environment.

Collect these values:

- **Integration Key** (OAuth client ID);
- **API User ID** for the user the connector will impersonate;
- **Account ID** to sync;
- the downloaded RSA **private key PEM**.

The API user must be a member of the target account and must be allowed to read
the envelopes this connector needs.

JWT Grant also requires one-time consent from that API user for the
`signature` and `impersonation` scopes. The setup helper can print the consent
URL. Its redirect URI must exactly match a redirect URI configured on the
integration.

Use `production` for a live account. Use `demo` only with a DocuSign developer
account.

## 2. Create the local configuration

From this directory, run:

```bash
python3 configure.py
```

The helper asks for the four DocuSign values, reads the private key from its
existing file, and writes the ignored `deployment/configuration.json`.

The default historical start is `2020-01-01T00:00:00Z`. Enter a later date if
less history is needed. After the first successful sync, Fivetran uses an
incremental cursor with a 15-minute safety lookback.

To build the file manually instead, copy `configuration.example.json` to
`deployment/configuration.json`. Generate the private-key value with:

```bash
base64 < /path/to/docusign-private-key.pem | tr -d '\n'
```

Paste the single-line result into `rsa_private_key_base64`.

## 3. Install and validate locally

```bash
cd "/Users/adeola/Boom Bookkeeping/fivetran/docusign"
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements-dev.txt
python -m unittest discover -s tests -v
cd deployment
fivetran debug --configuration configuration.json
```

The debug command uses the real DocuSign account and creates a local test
warehouse under `deployment/files/`. Review the reported row counts before
deploying.

If DocuSign returns `consent_required`, open the consent URL printed by
`configure.py` while signed in as the configured API user.

If DocuSign says the user cannot access the account, re-check `user_id`,
`account_id`, and the user's account membership. The connector discovers the
correct regional API hostname automatically; no `na4`, `na3`, or other base URL
needs to be configured.

## 4. Deploy to Fivetran

Create a scoped or system Fivetran API key that can:

- manage connections in the target destination;
- read the target destination.

In the shell, set the values without committing them:

```bash
export FIVETRAN_API_KEY='replace_me'
export FIVETRAN_API_SECRET='replace_me'
export FIVETRAN_DESTINATION='Warehouse'
```

Change into the deployment directory:

```bash
cd "/Users/adeola/Boom Bookkeeping/fivetran/docusign/deployment"
```

Create the required base64 credential and deploy:

```bash
export FIVETRAN_API_KEY_BASE64="$(
  printf '%s' "${FIVETRAN_API_KEY}:${FIVETRAN_API_SECRET}" | base64
)"

fivetran deploy \
  --api-key "${FIVETRAN_API_KEY_BASE64}" \
  --destination "${FIVETRAN_DESTINATION}" \
  --connection docusign \
  --configuration configuration.json \
  --python 3.12
```

Clear the shell values afterward:

```bash
unset FIVETRAN_API_KEY
unset FIVETRAN_API_SECRET
unset FIVETRAN_API_KEY_BASE64
unset FIVETRAN_DESTINATION
```

The new connection is paused after deployment. In Fivetran, open the
`docusign` connection, review the schema, then choose **Start Initial Sync**.

Fivetran encrypts the configuration values during deployment. They can later be
rotated in the connection's **Settings → Configuration(s)** screen or by
redeploying with an updated `configuration.json`.

## Expected destination tables

The connection creates:

```text
docusign.envelopes
docusign.recipients
docusign.custom_fields
docusign.templates
```

There should be no `documents` or `document_contents` table.

After the first sync, a useful BigQuery smoke test is:

```sql
select
  status,
  count(*) as envelopes,
  max(status_changed_datetime) as latest_status_change
from `YOUR_PROJECT.docusign.envelopes`
group by status
order by envelopes desc;
```

## Files

- `deployment/connector.py` — deployed connector code;
- `deployment/requirements.txt` — deployed dependency;
- `configuration.example.json` — safe placeholder values;
- `configure.py` — local configuration helper;
- `requirements-dev.txt` — local Fivetran SDK dependency;
- `tests/` — credential-free unit tests.
