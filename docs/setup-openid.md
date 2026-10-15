# OpenID + Entra Manual Setup

This guide explains how to configure the same OpenID/Entra model that the Bicep templates now deploy:

- API app registration exposes delegated scopes (default includes `app.use`)
- Client app registration requests Graph scopes and selected API delegated scopes
- Enterprise apps require assignment (`appRoleAssignmentRequired = true`)
- Only assigned users can sign in

## 1. Prerequisites

1. You are in the target Entra tenant.
2. You can create app registrations and enterprise applications.
3. You have admin rights to grant tenant-wide consent.
4. You know the callback URI used by your app (for Container Apps Easy Auth this is typically `https://<app-host>/.auth/login/aad/callback`).

## 2. Create API App Registration

1. Go to Entra admin center -> App registrations -> New registration.
2. Name it (example: `ca-api-<env>`).
3. Set supported account types to `Accounts in this organizational directory only`.
4. Create the app.

### Configure Application ID URI

1. Open the API app -> Expose an API.
2. Set Application ID URI.
3. Use a valid URI format, for example:

- `api://<api-app-id>`
- `api://<verified-domain>/<api-app-name>`

## 3. Expose Delegated API Scopes

1. In API app -> Expose an API -> Add one or more scopes.
2. Common first scope: `app.use`.
3. For each scope, set admin and user consent display names/descriptions.
4. Set each scope state to Enabled.
5. Save and copy the scope identifiers (GUIDs) for verification.

## 4. Create Client App Registration

1. Go to App registrations -> New registration.
2. Name it (example: `ca-app-<env>`).
3. Set supported account types to `Accounts in this organizational directory only`.
4. Add web redirect URI(s) if available now; otherwise add later.
5. Create the app.

## 5. Configure Client Redirect URIs

1. Open client app -> Authentication.
2. Under Web, add callback URI(s), for example:

- `https://<app-host>/.auth/login/aad/callback`
- `http://localhost:50505/.auth/login/aad/callback` (local testing only)

3. Enable ID token under Implicit grant and hybrid flows if your auth flow needs it.

## 6. Add API Permissions to Client

1. Open client app -> API permissions -> Add a permission.
2. Add Microsoft Graph delegated permissions:

- `User.Read`
- `openid`
- `profile`
- `offline_access`

3. Add your API delegated permissions:

- APIs my organization uses -> select your API app -> choose all delegated scopes required by this client app (for example `app.use` plus any additional scopes)

4. Click Grant admin consent for the tenant.

## 7. Restrict Sign-In to Assigned Users Only

Apply to both enterprise apps (client and API if desired):

1. Go to Entra admin center -> Enterprise applications.
2. Open the service principal for your app registration.
3. Properties -> Assignment required? -> set to `Yes`.
4. Save.

When this is enabled, users cannot sign in unless assigned.

## 8. Assign Allowed Users (Including Deployer)

1. In Enterprise applications -> select client app service principal.
2. Go to Users and groups -> Add user/group.
3. Select allowed users/groups.
4. Assign the `User` app role if prompted.
5. Ensure the deployer account is included.

Repeat for API service principal if you also enforce assignment there.

## 9. Optional CLI Verification

Use Azure CLI to confirm app IDs and service principals:

```bash
az ad app list --display-name <client-app-name> --query "[].{appId:appId,id:id,displayName:displayName}" -o table
az ad app list --display-name <api-app-name> --query "[].{appId:appId,id:id,displayName:displayName}" -o table
az ad sp list --display-name <client-app-name> --query "[].{id:id,appId:appId,displayName:displayName}" -o table
az ad sp list --display-name <api-app-name> --query "[].{id:id,appId:appId,displayName:displayName}" -o table
```

## 10. Map to This Repository

Current infra implementation:

- `infra/api-registration.bicep`: creates API app registration, exposes delegated scopes from `delegatedScopes`, creates API service principal, enforces assignment required.
- `infra/app-registration.bicep`: creates client app registration, optional redirect URIs, requests Graph scopes, optionally requests API delegated scopes via `apiScopeIds`, creates client service principal, enforces assignment required.
- `infra/main.bicep`: wires API outputs (`apiAppId`, `apiScopeIds`) into client registration and passes `apiDelegatedScopes` into API registration.

## 11. Troubleshooting

1. `AADSTS65001` or consent errors:

- Admin consent is missing for one or more delegated permissions.

2. `AADSTS50105` user assignment required:

- User is not assigned to the enterprise app while assignment is required.

3. Redirect mismatch:

- The app callback URI must exactly match the value configured in Entra.

4. API scope not visible in client permissions:

- Confirm API app has `app.use` scope enabled and service principal exists.

## 12. Security Notes

1. Keep supported account type as single-tenant (`AzureADMyOrg`) unless cross-tenant is intentional.
2. Use least privilege in delegated permissions.
3. Use group assignment for access control at scale.
4. Remove local HTTP redirect URIs outside development.
