# PlanSurf Budget V2

An isolated starter for rebuilding PlanSurf Budget around user-owned OneDrive storage and client-side encryption. The current static site includes the budget UI and legacy password-based sync to `plansurf-service`; it does not implement Microsoft sign-in, client-side encryption, or OneDrive sync, and is not ready for real user data.

## Architecture target

```text
Browser app
  - authenticates the user with Microsoft
  - encrypts/decrypts budget data locally
  - sends only ciphertext to the sync API

Render API
  - validates the user's session
  - keeps Microsoft refresh/access tokens encrypted at rest
  - reads/writes the user's app-specific OneDrive folder
  - never receives the budget key or plaintext budget data

User's OneDrive
  - owns the encrypted budget file
  - remains available to the user after app access is revoked
```

The existing `plansurf.service` is not a compatible sync backend for this design: its current budget route accepts and stores plaintext JSON in a shared GitHub repository. V2 needs a separate API contract and an explicit migration before it can claim server-blind storage.

## Run the static container

Requires Docker:

```powershell
docker build -t plansurf-budgetv2:local .
docker run --rm -p 8080:8080 plansurf-budgetv2:local
```

Open `http://localhost:8080`; `http://localhost:8080/health` is the container health endpoint. The image serves static files as an unprivileged Nginx process. The same image can later run under Kubernetes behind a `Deployment`, `Service`, and HTTPS `Ingress`.

The current page loads React, ReactDOM, PapaParse, and Babel from `unpkg.com`. Nginx applies a per-response nonce to Babel's transformed JSX and allows requests to the legacy sync API. These are prototype accommodations, not a production-ready dependency or privacy boundary; replace the external scripts with pinned, locally bundled assets and a build-time JSX transform before handling real financial data.

## Before connecting OneDrive

1. Register a Microsoft Entra application and choose supported account types, redirect URI, and the narrowest delegated OneDrive permission compatible with the desired app-folder behavior. Verify current Microsoft permissions and consent requirements before release.
2. Define the OAuth flow and token lifecycle. If the API stores refresh tokens, encrypt them at rest, scope them to the user, support disconnect/revocation, and never put them in the frontend bundle.
3. Define a versioned encrypted-file format using reviewed cryptographic libraries and authenticated encryption. Derive/protect keys on the client; never send passphrases, keys, or plaintext to the API. Document recovery and lost-passphrase behavior.
4. Implement conflict handling, backup/version history, export, delete, and disconnect behavior. Test multi-device sync and revocation before onboarding users.
5. Bundle and pin all client dependencies, remove third-party scripts from the sensitive app, review the CSP, and protect the release pipeline. A hosted client can technically be changed to capture data before encryption, so do not promise protection from a malicious client release.
6. Migrate existing data deliberately. The current service stores plaintext budget JSON; previously stored copies/backups need an explicit retention and deletion plan.

The hosted-client caveat is a trust-boundary issue to plan for now. You can defer stronger mitigations while building a prototype with test data, but address the release pipeline, dependency policy, and accurate privacy claims before collecting real users' financial data.