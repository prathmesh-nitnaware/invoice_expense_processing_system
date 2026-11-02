# DevOps Infrastructure & Local Environment Setup Guide

This guide provides step-by-step instructions to configure, run, and verify the DevOps toolchain for the **AI-Powered Invoice & Expense Processing System**.

---

## 1. Overview of DevOps Services

The complete toolchain can be managed with Docker Compose:

| Service | Port | Compose File | Profile / Container Name |
|---|---|---|---|
| **FastAPI Backend** | 8000 | `docker-compose.yml` | `invoice_backend` |
| **React Frontend** | 80 / 3000 | `docker-compose.yml` | `invoice_frontend` |
| **PostgreSQL 16** | 5432 | `docker-compose.yml` | `invoice_db` |
| **Nginx Reverse Proxy** | 80, 3000 | `docker-compose.yml` | `invoice_proxy` |
| **Jenkins Controller** | 8080, 50000 | `docker-compose.devops.yml` | `invoice_jenkins` |
| **SonarQube** | 9000 | `docker-compose.devops.yml` | `invoice_sonarqube` |
| **Prometheus** | 9090 | `docker-compose.devops.yml` | `invoice_prometheus` |
| **Grafana** | 3001 | `docker-compose.devops.yml` | `invoice_grafana` |

> **Important**: DevOps tooling (Jenkins, SonarQube, Prometheus, Grafana) is intentionally separated into `docker-compose.devops.yml`. The application starts independently without requiring heavyweight CI/CD containers.

---

## 2. Starting the Application Stack

### Production / Standard Mode
Starts PostgreSQL, Backend, Frontend, and Nginx Reverse Proxy:
```bash
docker compose up -d --build
```
Verify health:
```bash
curl http://localhost:8000/health
curl http://localhost/health
```

### Local Development Mode (with Live Hot-Reloading)
```bash
docker compose -f docker-compose.dev.yml up -d
```

---

## 3. Starting the DevOps & Monitoring Stack

To launch Jenkins, SonarQube, Prometheus, and Grafana:
```bash
docker compose -f docker-compose.devops.yml up -d
```

---

## 4. Local Jenkins Controller Setup

### A. Accessing Jenkins
1. Open [http://localhost:8080](http://localhost:8080) in your browser.
2. Retrieve the initial admin password from container logs:
   ```bash
   docker logs invoice_jenkins
   ```
   Or read directly from the persistent volume:
   ```bash
   docker exec -it invoice_jenkins cat /var/jenkins_home/secrets/initialAdminPassword
   ```

### B. Recommended Plugins
Install the following plugins during initial setup or via **Manage Jenkins &rarr; Plugins**:
- **Pipeline** (`workflow-aggregator`)
- **Git** & **GitHub Plugin**
- **Docker Pipeline** (`docker-workflow`)
- **SonarQube Scanner** (`sonar`)
- **Credentials Binding Plugin**
- **HTML Publisher** & **JUnit Plugin**
- **AnsiColor**

### C. Docker-in-Docker / Docker Socket Security Notice
The Jenkins container mounts the host Docker socket (`/var/run/docker.sock`).
> **Security Implication**: Granting a container access to `/var/run/docker.sock` provides root-equivalent control over the host Docker daemon.
> - **In Local Dev**: This enables Jenkins to build and test Docker images seamlessly without nested Docker-in-Docker (DinD) overhead.
> - **In Production**: Use isolated ephemeral Docker build agents, rootless containers, or a dedicated build cluster (e.g., Kaniko or Podman) to prevent privilege escalation.

### D. Configuring Jenkins Credentials
Navigate to **Manage Jenkins &rarr; Credentials &rarr; System &rarr; Global credentials**:
1. **Docker Hub**:
   - Kind: `Username with password`
   - ID: `docker-hub-credentials`
   - Username: `<your_dockerhub_username>`
   - Password: `<your_dockerhub_access_token>`
2. **SonarQube Token**:
   - Kind: `Secret text`
   - ID: `sonarqube-token`
   - Secret: `<token_generated_in_sonarqube>`
3. **GitHub Personal Access Token**:
   - Kind: `Secret text` or `Username with password`
   - ID: `github-credentials`

### E. Creating the Pipeline Job
1. Click **New Item** &rarr; Name: `invoice-expense-system` &rarr; Select **Pipeline**.
2. Under **Pipeline Definition**, select **Pipeline script from SCM**.
3. SCM: **Git**
4. Repository URL: `https://github.com/prathmesh-nitnaware/invoice_expense_processing_system.git`
5. Branch Specifier: `*/devops/ci-cd-implementation` (or `*/main`)
6. Script Path: `Jenkinsfile`
7. Click **Save** &rarr; **Build Now**.

### F. Native Windows Jenkins Agent & Service Configuration
When Jenkins runs natively on Windows (e.g., as a Windows Service under account `jenkins-svc` at `C:\Users\jenkins-svc\AppData\Local\Jenkins\.jenkins\workspace\Invoice-Expense-Processing`):

#### 1. Why Native Windows Failed with `CreateProcess error=2`
The initial pipeline failed with `Cannot run program "sh": CreateProcess error=2` because the `Jenkinsfile` invoked Linux shell steps (`sh`). On a native Windows host, `sh.exe` is not natively installed or in system PATH. The pipeline has been updated to use native Windows `powershell` steps.

#### 2. Windows Host Tool Prerequisites for `jenkins-svc`
Ensure the following tools are installed and present in the system-wide `PATH` (accessible by the `jenkins-svc` service user):

| Tool | Recommended Version | Verification Command | Notes for Windows Service |
|---|---|---|---|
| **Python** | 3.11+ (64-bit) | `python --version` | Install for All Users (`C:\Program Files\Python311`); add Python and Scripts to System PATH. |
| **Node.js & npm** | 18+ LTS | `node --version`, `npm --version` | Ensure `npm` and `node` are in System PATH. |
| **Docker Desktop** | Latest (WSL 2 backend) | `docker --version`, `docker compose version` | **Critical**: The service account `jenkins-svc` must belong to the `docker-users` group: `net localgroup docker-users jenkins-svc /add`. |
| **Trivy** | Latest | `trivy --version` | Install via `winget install aqua:trivy` or `choco install trivy` or copy `trivy.exe` to system PATH. |
| **SonarQube Scanner** | 5.0+ | `sonar-scanner.bat -v` | Download Windows CLI zip from SonarSource, extract to `C:\sonar-scanner`, and add `C:\sonar-scanner\bin` to System PATH. |
| **Git for Windows** | 2.40+ | `git --version` | Required for Jenkins Git plugin SCM checkout. |

#### 3. Restarting Jenkins Service After PATH Updates
Windows services do not dynamically inherit system PATH changes made after the service starts. After installing the tools above, restart the Jenkins service in an elevated PowerShell prompt:
```powershell
Restart-Service jenkins
```

---

## 5. SonarQube Setup & Quality Gate

### A. Accessing SonarQube
1. Open [http://localhost:9000](http://localhost:9000).
2. Default login credentials:
   - **Username**: `admin`
   - **Password**: `admin` (change upon first login).

### B. Project Setup
1. Click **Create Project** &rarr; **Manually**.
2. **Project key**: `invoice-expense-processing-system`
3. **Display name**: `AI-Powered Invoice & Expense Processing System`
4. Set up as **Locally**.

### C. Generating an Analysis Token
1. Go to **My Account &rarr; Security &rarr; Generate Token**.
2. Token Name: `jenkins-sonar-scanner`.
3. Type: `Project Analysis Token`.
4. Save this token as `sonarqube-token` in Jenkins Credentials.

### D. Configuring SonarQube Server in Jenkins
1. In Jenkins: **Manage Jenkins &rarr; System &rarr; SonarQube servers**.
2. Check **Enable injection of SonarQube server configuration**.
3. Name: `SonarQube`
4. Server URL: `http://sonarqube:9000` (within container network) or `http://host.docker.internal:9000`.
5. Server authentication token: select `sonarqube-token`.

---

## 6. Trivy Security Scanning

Trivy scans the repository filesystem and container images for known CVEs and sensitive secrets.

### A. Run Filesystem Scan Locally
```bash
# High and Critical vulnerabilities in dependencies and configuration
trivy fs --severity HIGH,CRITICAL --format table .
```

### B. Run Docker Image Scan
```bash
# Scan Backend image
trivy image --severity HIGH,CRITICAL prathmeshnitnaware/invoice-expense-system-backend:latest

# Scan Frontend image
trivy image --severity HIGH,CRITICAL prathmeshnitnaware/invoice-expense-system-frontend:latest
```

### C. Vulnerability Remediation Policy
- **CRITICAL Vulnerabilities**: Pipeline will halt (`exit-code 1`). Must be patched or updated before release.
- **HIGH Vulnerabilities**: Highlighted in scan report for review.
- **Suppression Policy**: Vulnerabilities may only be excluded via `.trivyignore` if they are verified non-exploitable in the application runtime and documented with rationale.

---

## 7. Prometheus & Grafana Monitoring

### A. Accessing Prometheus
- URL: [http://localhost:9090](http://localhost:9090)
- Verify active scrape targets under **Status &rarr; Targets**:
  - `invoice-backend` (`backend:8000/metrics`) &rarr; Status should be **UP**.

### B. Accessing Grafana
- URL: [http://localhost:3001](http://localhost:3001)
- Default credentials: `admin` / `admin`.
- The Prometheus datasource and the **"AI Invoice System - Service & API Performance"** dashboard are pre-provisioned automatically.
- Dashboard includes:
  - API Request Throughput (req/s)
  - 95th Percentile Response Latencies
  - HTTP 2xx, 4xx, 5xx Status Distribution
  - Backend Process Memory (MB)
  - CPU Utilization Rate
