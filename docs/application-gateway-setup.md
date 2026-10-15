# Adding Application Gateway in Front of the App Container App

High-level steps to expose the `app` (web) container app publicly via Application Gateway + WAF, while keeping the Container Apps Environment internal.

## 1. Keep the CAE internal

- Leave `container-apps-environment.bicep` with `internal: true` / `publicNetworkAccess: 'Disabled'` for the environment(s) hosting `app` (and `api`).
- Note the environment's `staticIp` and default domain outputs — needed later for DNS.

## 2. Add a dedicated subnet for the gateway

- In `vnet.bicep`, add a new subnet (e.g. `agw`) sized `/24` minimum, no delegation.
- Application Gateway v2 requires its own subnet, separate from the CAE subnet.

## 3. Provision a Private DNS zone for the CAE default domain

- Create a Private DNS zone named after the CAE's default domain.
- Link it to the VNet.
- Add a wildcard `*` and root `@` A record pointing to the CAE's `staticIp`.
- This lets the gateway resolve the container app's FQDN internally.

## 4. Provision Application Gateway (WAF_v2)

- New module, e.g. `infra/application-gateway.bicep`, using AVM module `br/public:avm/res/network/application-gateway`.
- Configure:
  - `sku: 'WAF_v2'` with a `firewallPolicyResourceId` (or `Standard_v2` if WAF isn't needed yet).
  - `gatewayIPConfigurations` → the `agw` subnet.
  - `frontendIPConfigurations` → public IP (new `Microsoft.Network/publicIPAddresses` resource, Standard SKU).
  - `backendAddressPools` → the container app's FQDN.
  - `backendHttpSettingsCollection` → port 443, protocol `Https`, `pickHostNameFromBackendAddress: true`.
  - `httpListeners` → frontend IP + port 443 + SSL certificate.
  - `requestRoutingRules` → tie listener + backend pool + backend settings together.

## 5. Certificates

- Get a public TLS cert for the custom domain (or use Key Vault reference in the AVM module).
- Bind it to the gateway's `sslCertificates`.

## 6. Preserve original host header (optional but recommended)

- Add a rewrite rule injecting `X-Forwarded-Host: {http_req_host}` on the backend settings, so the app can see the real requested host for redirects/OIDC callbacks.

## 7. DNS for the public-facing domain

- Point your real public domain's A record at the Application Gateway's public IP (not the CAE).

## 8. Wire into `main.bicep`

- Add the `agw` subnet output from `vnet.bicep`.
- Add the new `application-gateway.bicep` module call, depending on `vnet`, the `app` container app (for its FQDN), and the private DNS zone.
- Pass the gateway's public IP/FQDN as an output for use in DNS setup docs.

## 9. Validate

- `azd provision` / `az deployment what-if` first.
- After deploy, hit the gateway's public IP/domain and confirm it reaches the `app` container app, then test Entra sign-in redirect works correctly (host header preservation).

## Notes

- Do this once for `app`. If `api` (or multiple prod APIs) also need public exposure, add additional backend pools + path-based routing rules (`urlPathMaps`) on the same gateway rather than provisioning a second gateway.
- Container Apps Environment itself stays `internal: true` throughout — only the gateway is public-facing.
