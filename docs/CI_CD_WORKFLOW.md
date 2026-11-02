# CI/CD Architecture & Release Workflow Guide

This document describes the continuous integration and delivery architecture, branching guidelines, security quality gates, and deployment workflows for the **AI-Powered Invoice & Expense Processing System**.

---

## 1. Branching Strategy

We enforce a strict Git flow to prevent unvetted code from reaching production:

```
  feature/xyz ──► devops/ci-cd-implementation ──► Pull Request ──► main (Production)
       ▲                        │                      ▲               │
       │                        ▼                      │               ▼
Local Development       Automated CI Tests      Code Review &     Production Deploy
 & Unit Verification     & Quality Analysis       PR Checks       (Manual Approval Gate)
```

### Core Rules:
1. **Never push development commits directly to `main`**.
2. **Feature Branches**:
   - Create focused branches (e.g. `devops/ci-cd-implementation`, `feature/vendor-matching`).
   - Test locally with `pytest` and `npm run build` before opening PRs.
3. **Pull Request Protocol**:
   - Target `main` via PR.
   - GitHub Actions executes automated tests, coverage checks, frontend builds, and Trivy filesystem scans.
   - Code review and peer approval required before merging.
4. **Production Releases**:
   - Merging into `main` triggers the Jenkins Production Pipeline.
   - Production deployment mandates an explicit **Human Approval Gate**.

---

## 2. GitHub to Jenkins Webhook Integration

### Production Scenario
In production, GitHub sends push and pull request webhooks directly to Jenkins:
1. In GitHub Repository: **Settings &rarr; Webhooks &rarr; Add Webhook**.
2. **Payload URL**: `https://<jenkins-domain>/github-webhook/`
3. **Content type**: `application/json`
4. **Events**: *Pushes* and *Pull requests*.

### Local Development Alternatives
When Jenkins runs locally on `http://localhost:8080`, GitHub cannot reach private IP addresses directly:

- **Option A (Polling SCM - Recommended for Local Dev)**:
  Configure the Jenkins job with **Build Triggers &rarr; Poll SCM**:
  `H/5 * * * *` (checks GitHub every 5 minutes for new commits).
- **Option B (Webhook Relay Tunnel)**:
  Use a lightweight webhook proxy such as Smee.io or ngrok:
  ```bash
  # Using Smee client
  npm install --global smee-client
  smee --url https://smee.io/your-custom-channel --target http://localhost:8080/github-webhook/
  ```
- **Option C (Manual Trigger)**:
  Trigger builds on-demand via the **Build Now** button in Jenkins UI or using the Jenkins CLI/API.

---

## 3. Jenkins Pipeline Stages Breakdown

The root `Jenkinsfile` defines a 15-stage declarative pipeline designed for high resilience:

```
 ┌─────────────┐     ┌───────────────────────┐     ┌───────────────────────┐
 │ 1. Checkout │ ──► │ 2. Environment Verify │ ──► │ 3. Backend Deps (Venv)│
 └─────────────┘     └───────────────────────┘     └───────────┬───────────┘
                                                               │
 ┌───────────────────────┐     ┌───────────────────────┐       ▼
 │ 6. Frontend Build     │ ◄── │ 5. Pytest Suite (14)  │ ◄── ┌───────────────────────┐
 └───────────┬───────────┘     └───────────────────────┘     │ 4. Frontend Deps (Npm)│
             │                                               └───────────────────────┘
             ▼
 ┌───────────────────────┐     ┌───────────────────────┐     ┌───────────────────────┐
 │ 7. Coverage Generate  │ ──► │ 8. SonarQube Scanner  │ ──► │ 9. Quality Gate Wait  │
 └───────────────────────┘     └───────────────────────┘     └───────────┬───────────┘
                                                                         │
 ┌───────────────────────┐     ┌───────────────────────┐                 ▼
 │ 12. Container Scan    │ ◄── │ 11. Docker Image Build│ ◄── ┌───────────────────────┐
 └───────────┬───────────┘     └───────────────────────┘     │ 10. Trivy Repo Scan   │
             │                                               └───────────────────────┘
             ▼
 ┌───────────────────────┐     ┌───────────────────────┐     ┌───────────────────────┐
 │ 13. Image Tagging     │ ──► │ 14. Docker Hub Push   │ ──► │ 15. Deployment Gate   │
 └───────────────────────┘     └───────────────────────┘     └───────────────────────┘
```

### Detailed Stage Description:

1. **Checkout**: Pulls Git repository revision cleanly.
2. **Environment Validation**: Validates Docker, Python, and Node versions on agent.
3. **Backend Dependency Installation**: Installs Python dependencies in an isolated virtual environment (`venv`).
4. **Frontend Dependency Installation**: Installs npm modules using `npm ci`.
5. **Backend Automated Tests**: Executes 14 pytest business scenarios with JUnit XML output (`test-results.xml`).
6. **Frontend Build & Tests**: Compiles Vite bundle into `dist/`.
7. **Test Coverage Generation**: Produces `coverage.xml` via `pytest-cov`.
8. **SonarQube Analysis**: Runs static code analysis covering bugs, vulnerabilities, and code smells.
9. **SonarQube Quality Gate**: Blocks the pipeline if code quality standards or coverage thresholds are not met.
10. **Trivy Filesystem Scan**: Inspects dependencies and files for high/critical CVEs.
11. **Docker Image Build**: Builds production images with multi-stage non-root Dockerfiles.
12. **Trivy Container Image Scan**: Checks built Docker images for OS-level vulnerabilities.
13. **Docker Image Tagging**: Tags images with build number, Git SHA, and `latest`.
14. **Docker Hub Push**: Authenticates using Jenkins credentials and pushes tagged images to Docker Hub.
15. **Deployment**:
    - **Feature Branch**: Deploys to Staging (`docker compose -f docker-compose.dev.yml up -d`).
    - **Main Branch**: Halts at an **Interactive Input Gate** (`Approve deployment of <TAG> to Production?`). Upon authorization, updates containers (`docker compose up -d`) and verifies live `/health`.

---

## 4. Production Rollback Procedure

If a production defect is detected post-deployment:

### Immediate Container Rollback
Deploy the previously verified Docker image tag:
```bash
# Set image tag to previous stable build (e.g. build 42)
export IMAGE_TAG=42-abc1234
docker compose up -d --no-build
```

### Git Revert Protocol
1. Revert the offending commit on a new branch:
   ```bash
   git checkout -b fix/revert-change
   git revert <bad_commit_hash>
   git push origin fix/revert-change
   ```
2. Open emergency Pull Request into `main`.
3. Once merged, Jenkins automatically builds, tests, scans, and requests approval for the roll-forward release.
