# Custom DNS for `app` and `api` via Application Gateway (Azure-delegated DNS)

Steps to expose `app` and `api` on custom subdomains, with DNS delegated to Azure DNS.

## 1. Provision the Azure DNS zone

- New module, e.g. `infra/dns-zone.bicep`, using `br/public:avm/res/network/dns-zone`.
- One zone resource for the apex domain (e.g. `contoso.com`).
- Output the zone's Azure-assigned name servers.
- Update the domain registrar's NS records to these name servers (manual, one-time, outside bicep).

## 2. Add DNS records pointing at the gateway

- `A` record for `app` subdomain → `applicationGateway.outputs.publicIpAddress`.
- `A` record for `api` subdomain → same public IP (one gateway, one IP, routing splits by Host header).
- Add as child resources in `dns-zone.bicep`, or a separate `dns-records.bicep` depending on the zone.

## 3. Replace the self-signed cert with a real, DNS-validated cert

- [agw-cert.bicep](../infra/agw-cert.bicep) currently generates a self-signed cert (CN `agw-poc.local`) via `openssl` in a deployment script.
- Swap this for an ACME client (e.g. `certbot` with `certbot-dns-azure`) that solves the DNS-01 challenge against the new zone, then imports the resulting cert into Key Vault the same way.
- A wildcard cert (`*.contoso.com`) covers both `app.` and `api.` subdomains with one cert.
- Grant the script's managed identity `DNS Zone Contributor` on the new zone (in addition to its existing Key Vault Certificates Officer role) so it can create/delete the `_acme-challenge` TXT record.

## 4. Convert the gateway to host-based (multi-site) routing

- [application-gateway.bicep](../infra/application-gateway.bicep) currently has one listener (`https-listener`) with no `hostNames`, and path-based routing (`/api/*` → api pool).
- Add `appHostName` / `apiHostName` params.
- Change `httpListeners` to two entries, each with `hostNames: [appHostName]` / `[apiHostName]` on the same frontend IP/port 443.
- Add a second `requestRoutingRules` entry (type `Basic`) pointing the api listener directly at `apiPoolName`/`apiHttpSettingsName` — the `/api` path map + rewrite rule set is no longer needed for that listener.
- Bind the wildcard/real cert from step 3.

## 5. Wire the new params through `main.bicep`

- Add `appHostName`/`apiHostName` params, sourced from `main.parameters.json`/azd env vars.
- Add the DNS zone module (order doesn't need to be strict — it's just an A record to a static IP shape).
- Pass `appHostName`/`apiHostName` (e.g. `'app.${dnsZone.outputs.name}'`) into the `applicationGateway` module call.
- Replace the public-IP-based outputs (`NG_APP_URI`, `NG_API_URI`, `API_ENV_CORS_WHITELIST`, redirect URIs, currently around lines 742-769) with the custom domain equivalents.
- Add a role assignment giving the cert script's identity `DNS Zone Contributor` scoped to the new zone.

## 6. Update dependent app registrations

- [app-registration.bicep](../infra/app-registration.bicep) / [api-registration.bicep](../infra/api-registration.bicep) redirect URIs and CORS need the new custom domains instead of `https://${publicIpAddress}`.

## 7. Validate

- `az deployment what-if` (or the azure-validate skill) before applying.
- After deploy: confirm zone delegation propagated (`dig NS contoso.com`), A records resolve to the gateway's public IP, the ACME DNS-01 challenge succeeds, both `app.` and `api.` domains serve with valid certs, and Entra sign-in redirects work against the new domains.
