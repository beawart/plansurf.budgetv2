# PlanSurf Budget V2

PlanSurf Budget stores its synced budget in the signed-in user's OneDrive app folder. Microsoft sign-in and Microsoft Graph requests run directly in the browser; the budget file is encrypted locally before upload. No budget backend is required.

## Architecture target

```text
Browser app
  - signs in to the user's personal Microsoft account
  - encrypts/decrypts the budget with a user-held passphrase
  - reads/writes ciphertext directly to Microsoft Graph

User's OneDrive
  - owns the encrypted file in the PlanSurf app folder
  - remains under the user's Microsoft account and can be deleted there
```

The optional migration action reads the existing plaintext budget from `plansurf-service`, encrypts it in the browser, and saves it to OneDrive. It does not delete the old copy in the private GitHub repository; retention and deletion there must be handled separately.

## Run the static container

Requires Docker. Set the public Microsoft Entra application client ID in `site/config.js` before building locally.

```powershell
docker build -t plansurf-budgetv2:local .
docker run --rm -p 8080:8080 plansurf-budgetv2:local
```

Open `http://localhost:8080`; `http://localhost:8080/health` is the container health endpoint. The image serves static files as an unprivileged Nginx process. The same image can later run under Kubernetes behind a `Deployment`, `Service`, and HTTPS `Ingress`.

### Microsoft Entra setup

1. Register a **single-page application** supporting personal Microsoft accounts.
2. Under **Authentication → Add a platform → Single-page application**, add the redirect URI for each environment where you will run the app:
   - `http://localhost:8080/` for local Docker.
   - `https://beawart.github.io/plansurf.budgetv2/` for GitHub Pages.
3. Add the delegated Microsoft Graph permission `Files.ReadWrite.AppFolder` and grant user consent as required. Do not create a client secret; the client ID is public.
4. For Docker, copy the Application (client) ID into `site/config.js` and rebuild. For GitHub Pages, add a repository variable named `MICROSOFT_CLIENT_ID` under **Settings → Secrets and variables → Actions → Variables**; the Pages workflow writes it into the deployed config.

The app uses the `consumers` authority and saves `PlanSurfBudget.enc.json` under the app's OneDrive `Apps` folder. It does not request access to the rest of the user's drive. Microsoft sign-in, Graph file access, and the legacy migration require network connectivity.

### Encryption and migration

The file uses AES-256-GCM with a key derived in the browser from the user's passphrase using PBKDF2-SHA-256. The passphrase is not stored or sent to Microsoft; the same passphrase is needed on every device. There is no passphrase recovery. Losing it makes the encrypted OneDrive file unreadable. The app currently also keeps a plaintext working copy in that browser's local storage.

To move the existing budget, open Budget Sync, sign in to Microsoft, enter a new encryption passphrase and the current `plansurf-service` password, then choose **Import and encrypt existing budget**. Verify the OneDrive copy before separately arranging deletion/retention of the old GitHub-backed copy. Normal Load/Save actions only read/write the OneDrive file.

The page still uses browser-loaded React/Babel/PapaParse and MSAL assets. The per-response CSP nonce permits Babel's transformed app code without enabling inline scripts or `unsafe-eval`; `unsafe-inline` is allowed for styles because the existing React UI uses dynamic style attributes. A hosted client can be changed to capture data before encryption; bundle and pin dependencies, move JSX transformation to build time, review the release pipeline, and address local-storage protection before treating this as production-ready for financial data.

## Publish on GitHub Pages

This repository keeps the app in `site/`, which is not an available folder in the branch-based Pages picker (that picker only offers the repository root or `/docs`). The `.github/workflows/pages.yml` workflow deploys `site/` directly:

1. Push the workflow and app changes to the `main` branch.
2. In **Settings → Pages**, change **Source** to **GitHub Actions**. You do not need to select a branch/folder.
3. Add the `MICROSOFT_CLIENT_ID` Actions repository variable as described above.
4. Wait for the **Deploy GitHub Pages** workflow to finish. GitHub will show the site URL under **Settings → Pages** and in the workflow deployment.

The project URL is `https://beawart.github.io/plansurf.budgetv2/`. Sign-in uses a full-page redirect rather than a popup, so the app URL must be registered as an Entra SPA redirect URI. Without the client ID and redirect registration, the page can load, but OneDrive sign-in and saving are not enabled. The one-time legacy migration also depends on the existing service allowing browser requests from the Pages origin (CORS).

## Before production release

Before onboarding users, add a recovery/export plan, test multi-device sync and revocation, protect the release pipeline, and decide how to protect plaintext local browser storage and remove third-party runtime dependencies. Previously stored copies in GitHub and its backups need an explicit retention and deletion plan.