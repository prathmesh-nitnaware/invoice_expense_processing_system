pipeline {
    agent any

    options {
        timeout(time: 60, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '15', artifactNumToKeepStr: '10'))
        ansiColor('xterm')
        disableConcurrentBuilds()
    }

    environment {
        // Project metadata
        APP_NAME = 'invoice-expense-system'
        DOCKER_HUB_REPO = 'prathmeshnitnaware/invoice-expense-system'
        IMAGE_TAG = "${env.BUILD_NUMBER}-${env.GIT_COMMIT ? env.GIT_COMMIT.take(7) : 'latest'}"

        // Tooling credentials IDs (Configured in Jenkins Credentials Store)
        DOCKER_CREDENTIALS_ID = 'docker-hub-credentials'
        SONAR_CREDENTIALS_ID  = 'sonarqube-token'
        SONAR_SERVER_NAME     = 'SonarQube'

        // Scan Thresholds
        TRIVY_SEVERITY_FAIL   = 'CRITICAL'
    }

    stages {
        // ====================================================================
        // Stage 1: Checkout
        // ====================================================================
        stage('Checkout') {
            steps {
                echo "--> [Stage 1] Checking out source repository from GitHub..."
                checkout scm
                script {
                    echo "Branch: ${env.BRANCH_NAME ?: 'unknown'}, Commit: ${env.GIT_COMMIT ?: 'local'}"
                }
            }
        }

        // ====================================================================
        // Stage 2: Environment Validation
        // ====================================================================
        stage('Environment Validation') {
            steps {
                echo "--> [Stage 2] Validating Windows host environment and runtime tools..."
                powershell '''
                    $ErrorActionPreference = 'Stop'
                    Write-Host "=== Validating Windows Runtime Environment for Jenkins Agent ==="

                    # 1. Python Validation
                    $py = Get-Command python -ErrorAction SilentlyContinue
                    if (-not $py) {
                        $py = Get-Command py -ErrorAction SilentlyContinue
                    }
                    if (-not $py) {
                        throw "PREREQUISITE ERROR: 'python' is not installed or not in PATH for the Jenkins service account (jenkins-svc). Please install Python 3.11+ on Windows and add its install and Scripts directories to the system PATH."
                    }
                    Write-Host "Python detected: $(& $py.Source --version)"

                    # 2. Node.js Validation
                    $node = Get-Command node -ErrorAction SilentlyContinue
                    if (-not $node) {
                        throw "PREREQUISITE ERROR: 'node' is not installed or not in PATH for the Jenkins service account. Please install Node.js 18+ on Windows and add it to system PATH."
                    }
                    Write-Host "Node.js detected: $(node --version)"

                    # 3. npm Validation
                    $npm = Get-Command npm -ErrorAction SilentlyContinue
                    if (-not $npm) {
                        throw "PREREQUISITE ERROR: 'npm' is not installed or not in PATH for the Jenkins service account. Please ensure npm is in system PATH."
                    }
                    Write-Host "npm detected: $(npm --version)"

                    # 4. Docker CLI Validation
                    $docker = Get-Command docker -ErrorAction SilentlyContinue
                    if (-not $docker) {
                        throw "PREREQUISITE ERROR: 'docker' is not installed or not in PATH. Please install Docker Desktop (or Docker Engine CLI) on Windows and add it to system PATH."
                    }
                    Write-Host "Docker CLI detected: $(docker --version)"

                    # 5. Docker Daemon Connectivity Check
                    docker info > $null 2>&1
                    if ($LASTEXITCODE -ne 0) {
                        throw "PREREQUISITE ERROR: Docker daemon is not running or the Jenkins service account ('jenkins-svc') lacks permission to access the Docker pipe (npipe:////./pipe/docker_engine). Ensure Docker Desktop is running with Linux containers and add 'jenkins-svc' to the 'docker-users' local Windows group."
                    }
                    Write-Host "Docker daemon connectivity verified."

                    # 6. Docker Compose Validation
                    docker compose version
                    if ($LASTEXITCODE -ne 0) {
                        throw "PREREQUISITE ERROR: 'docker compose' is not available. Please verify Docker Compose plugin is installed."
                    }

                    Write-Host "Windows host environment pre-flight validation completed successfully."
                '''
            }
        }

        // ====================================================================
        // Stage 3: Backend Dependency Installation
        // ====================================================================
        stage('Backend Dependency Installation') {
            steps {
                echo "--> [Stage 3] Installing Python dependencies in isolated virtual environment..."
                powershell '''
                    $ErrorActionPreference = 'Stop'
                    Write-Host "Setting up Python virtual environment..."
                    if (-not (Test-Path "venv")) {
                        python -m venv venv
                        if ($LASTEXITCODE -ne 0) {
                            throw "Failed to create Python virtual environment 'venv'. Verify python-venv is available."
                        }
                    }

                    $venvPython = Join-Path (Get-Location).Path "venv/Scripts/python.exe"
                    if (-not (Test-Path $venvPython)) {
                        throw "Virtual environment python executable not found at: $venvPython"
                    }

                    Write-Host "Upgrading pip in venv..."
                    & $venvPython -m pip install --upgrade pip
                    if ($LASTEXITCODE -ne 0) { throw "pip upgrade failed with exit code $LASTEXITCODE" }

                    Write-Host "Installing requirements from backend/requirements.txt..."
                    & $venvPython -m pip install -r backend/requirements.txt
                    if ($LASTEXITCODE -ne 0) { throw "Backend dependency installation failed with exit code $LASTEXITCODE" }

                    Write-Host "Backend dependencies successfully installed."
                '''
            }
        }

        // ====================================================================
        // Stage 4: Frontend Dependency Installation
        // ====================================================================
        stage('Frontend Dependency Installation') {
            steps {
                echo "--> [Stage 4] Installing Node.js frontend dependencies..."
                powershell '''
                    $ErrorActionPreference = 'Stop'
                    Set-Location frontend

                    if (Test-Path "package-lock.json") {
                        Write-Host "Running npm ci for deterministic dependency installation..."
                        npm ci
                        if ($LASTEXITCODE -ne 0) {
                            Write-Warning "npm ci exited with code $LASTEXITCODE; attempting npm install fallback..."
                            npm install
                            if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE" }
                        }
                    } else {
                        Write-Host "Running npm install..."
                        npm install
                        if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE" }
                    }

                    Write-Host "Frontend dependencies successfully installed."
                '''
            }
        }

        // ====================================================================
        // Stage 5: Backend Automated Tests
        // ====================================================================
        stage('Backend Automated Tests') {
            steps {
                echo "--> [Stage 5] Executing 14 automated pytest business & security scenarios..."
                powershell '''
                    $ErrorActionPreference = 'Stop'
                    $venvPython = Join-Path (Get-Location).Path "venv/Scripts/python.exe"
                    $env:PYTHONPATH = (Get-Location).Path

                    Write-Host "Executing pytest suite with JUnit XML reporting..."
                    & $venvPython -m pytest backend/tests/ -v --junitxml=test-results.xml
                    if ($LASTEXITCODE -ne 0) {
                        throw "AUTOMATED TEST SUITE FAILED: pytest exited with code $LASTEXITCODE"
                    }
                    Write-Host "Backend test suite passed successfully."
                '''
            }
            post {
                always {
                    junit testResults: 'test-results.xml', allowEmptyResults: true
                }
            }
        }

        // ====================================================================
        // Stage 6: Frontend Build & Tests
        // ====================================================================
        stage('Frontend Build & Tests') {
            steps {
                echo "--> [Stage 6] Compiling React Vite production bundle..."
                powershell '''
                    $ErrorActionPreference = 'Stop'
                    Set-Location frontend

                    Write-Host "Building production React distribution..."
                    npm run build
                    if ($LASTEXITCODE -ne 0) {
                        throw "Frontend build failed with exit code $LASTEXITCODE"
                    }

                    if (-not (Test-Path "dist")) {
                        throw "Frontend build did not generate expected 'dist' bundle directory."
                    }
                    Write-Host "Frontend compiled successfully."
                '''
            }
        }

        // ====================================================================
        // Stage 7: Test Coverage Generation
        // ====================================================================
        stage('Test Coverage Generation') {
            steps {
                echo "--> [Stage 7] Generating Python test coverage report (coverage.xml)..."
                powershell '''
                    $ErrorActionPreference = 'Stop'
                    $venvPython = Join-Path (Get-Location).Path "venv/Scripts/python.exe"
                    $env:PYTHONPATH = (Get-Location).Path

                    Write-Host "Generating test coverage with pytest-cov..."
                    & $venvPython -m pytest backend/tests/ --cov=backend/app --cov-report=xml:coverage.xml --cov-report=term
                    if ($LASTEXITCODE -ne 0) {
                        throw "Coverage generation failed with exit code $LASTEXITCODE"
                    }

                    if (-not (Test-Path "coverage.xml")) {
                        throw "Expected coverage report 'coverage.xml' was not created."
                    }
                    Write-Host "Coverage report successfully generated."
                '''
            }
        }

        // ====================================================================
        // Stage 8: SonarQube Analysis
        // ====================================================================
        stage('SonarQube Analysis') {
            steps {
                echo "--> [Stage 8] Running SonarQube static analysis scanner..."
                withSonarQubeEnv(SONAR_SERVER_NAME) {
                    powershell '''
                        $ErrorActionPreference = 'Stop'

                        # Locate sonar-scanner on Windows
                        $scanner = Get-Command "sonar-scanner.bat" -ErrorAction SilentlyContinue
                        if (-not $scanner) {
                            $scanner = Get-Command "sonar-scanner.cmd" -ErrorAction SilentlyContinue
                        }
                        if (-not $scanner) {
                            $scanner = Get-Command "sonar-scanner" -ErrorAction SilentlyContinue
                        }

                        if (-not $scanner) {
                            throw "PREREQUISITE ERROR: SonarScanner ('sonar-scanner.bat') is not installed or not found in system PATH. Please download and install SonarQube Scanner for Windows, add its bin directory to system PATH, and verify SonarQube server connection in Jenkins System Configuration."
                        }

                        Write-Host "Executing SonarScanner via: $($scanner.Source)"
                        & $scanner.Source `
                            "-Dsonar.projectKey=invoice-expense-processing-system" `
                            "-Dsonar.projectName=AI-Powered Invoice & Expense Processing System" `
                            "-Dsonar.sources=backend/app,frontend/src" `
                            "-Dsonar.tests=backend/tests" `
                            "-Dsonar.python.coverage.reportPaths=coverage.xml"
                        if ($LASTEXITCODE -ne 0) {
                            throw "SonarQube analysis failed with exit code $LASTEXITCODE"
                        }
                        Write-Host "SonarQube static analysis completed."
                    '''
                }
            }
        }

        // ====================================================================
        // Stage 9: SonarQube Quality Gate
        // ====================================================================
        stage('SonarQube Quality Gate') {
            steps {
                echo "--> [Stage 9] Checking SonarQube Quality Gate compliance..."
                timeout(time: 5, unit: 'MINUTES') {
                    script {
                        def qg = waitForQualityGate()
                        if (qg.status != 'OK') {
                            error "Pipeline aborted: SonarQube Quality Gate failed with status: ${qg.status}"
                        }
                        echo "SonarQube Quality Gate passed successfully with status: ${qg.status}."
                    }
                }
            }
        }

        // ====================================================================
        // Stage 10: Trivy Filesystem Scan
        // ====================================================================
        stage('Trivy Filesystem Scan') {
            steps {
                echo "--> [Stage 10] Scanning project repository for secrets and vulnerability exposures..."
                powershell '''
                    $ErrorActionPreference = 'Stop'

                    $trivy = Get-Command "trivy.exe" -ErrorAction SilentlyContinue
                    if (-not $trivy) {
                        $trivy = Get-Command "trivy" -ErrorAction SilentlyContinue
                    }
                    if (-not $trivy) {
                        throw "PREREQUISITE ERROR: 'trivy' is not installed or not in system PATH for the Jenkins service account. Please install Trivy for Windows (e.g., 'choco install trivy' or 'winget install aqua:trivy' or download from https://github.com/aquasecurity/trivy/releases) and add to system PATH."
                    }

                    Write-Host "Running Trivy filesystem scan on repository..."
                    & $trivy.Source fs `
                        --severity HIGH,CRITICAL `
                        --format table `
                        --output trivy-fs-report.txt `
                        .

                    if (Test-Path "trivy-fs-report.txt") {
                        Get-Content trivy-fs-report.txt | Select-Object -First 50
                    }
                    Write-Host "Trivy filesystem scan completed."
                '''
            }
        }

        // ====================================================================
        // Stage 11: Docker Image Build
        // ====================================================================
        stage('Docker Image Build') {
            steps {
                echo "--> [Stage 11] Building hardened production container images..."
                powershell '''
                    $ErrorActionPreference = 'Stop'

                    $backendImg = "$($env:DOCKER_HUB_REPO)-backend:$($env:IMAGE_TAG)"
                    $frontendImg = "$($env:DOCKER_HUB_REPO)-frontend:$($env:IMAGE_TAG)"

                    Write-Host "Building Backend Docker image: $backendImg..."
                    docker build -t $backendImg -f backend/Dockerfile .
                    if ($LASTEXITCODE -ne 0) {
                        throw "Backend Docker build failed with exit code $LASTEXITCODE"
                    }

                    Write-Host "Building Frontend Docker image: $frontendImg..."
                    docker build -t $frontendImg -f frontend/Dockerfile .
                    if ($LASTEXITCODE -ne 0) {
                        throw "Frontend Docker build failed with exit code $LASTEXITCODE"
                    }

                    Write-Host "Docker images built successfully."
                '''
            }
        }

        // ====================================================================
        // Stage 12: Trivy Container Image Scan
        // ====================================================================
        stage('Trivy Container Image Scan') {
            steps {
                echo "--> [Stage 12] Scanning container images with Trivy..."
                powershell '''
                    $ErrorActionPreference = 'Stop'

                    $trivy = Get-Command "trivy.exe" -ErrorAction SilentlyContinue
                    if (-not $trivy) {
                        $trivy = Get-Command "trivy" -ErrorAction SilentlyContinue
                    }
                    if (-not $trivy) {
                        throw "PREREQUISITE ERROR: 'trivy' is not installed or not in system PATH."
                    }

                    $backendImg = "$($env:DOCKER_HUB_REPO)-backend:$($env:IMAGE_TAG)"
                    $frontendImg = "$($env:DOCKER_HUB_REPO)-frontend:$($env:IMAGE_TAG)"
                    $sev = $env:TRIVY_SEVERITY_FAIL

                    Write-Host "Scanning Backend Image ($backendImg) with threshold $sev..."
                    & $trivy.Source image `
                        --severity $sev `
                        --exit-code 1 `
                        --format table `
                        $backendImg
                    if ($LASTEXITCODE -ne 0) {
                        throw "SECURITY GATE FAILURE: Critical vulnerabilities detected in backend container image. Push aborted."
                    }

                    Write-Host "Scanning Frontend Image ($frontendImg) with threshold $sev..."
                    & $trivy.Source image `
                        --severity $sev `
                        --exit-code 1 `
                        --format table `
                        $frontendImg
                    if ($LASTEXITCODE -ne 0) {
                        throw "SECURITY GATE FAILURE: Critical vulnerabilities detected in frontend container image. Push aborted."
                    }

                    Write-Host "Container images passed Trivy security gate."
                '''
            }
        }

        // ====================================================================
        // Stage 13: Docker Image Tagging
        // ====================================================================
        stage('Docker Image Tagging') {
            steps {
                echo "--> [Stage 13] Applying release tags (latest and semantic build)..."
                powershell '''
                    $ErrorActionPreference = 'Stop'

                    $backendImg = "$($env:DOCKER_HUB_REPO)-backend:$($env:IMAGE_TAG)"
                    $frontendImg = "$($env:DOCKER_HUB_REPO)-frontend:$($env:IMAGE_TAG)"
                    $backendLatest = "$($env:DOCKER_HUB_REPO)-backend:latest"
                    $frontendLatest = "$($env:DOCKER_HUB_REPO)-frontend:latest"

                    Write-Host "Tagging $backendImg -> $backendLatest..."
                    docker tag $backendImg $backendLatest
                    if ($LASTEXITCODE -ne 0) { throw "Docker tag backend failed" }

                    Write-Host "Tagging $frontendImg -> $frontendLatest..."
                    docker tag $frontendImg $frontendLatest
                    if ($LASTEXITCODE -ne 0) { throw "Docker tag frontend failed" }

                    Write-Host "Images successfully tagged."
                '''
            }
        }

        // ====================================================================
        // Stage 14: Docker Hub Push
        // ====================================================================
        stage('Docker Hub Push') {
            when {
                anyOf {
                    branch 'main'
                    buildingTag()
                }
            }
            steps {
                echo "--> [Stage 14] Pushing images to Docker Hub registry..."
                withCredentials([usernamePassword(
                    credentialsId: DOCKER_CREDENTIALS_ID,
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    powershell '''
                        $ErrorActionPreference = 'Stop'
                        Write-Host "Logging into Docker Hub..."
                        $env:DOCKER_PASS | docker login -u $env:DOCKER_USER --password-stdin
                        if ($LASTEXITCODE -ne 0) {
                            throw "Docker login failed. Verify DOCKER_CREDENTIALS_ID in Jenkins credentials store."
                        }

                        $backendImg = "$($env:DOCKER_HUB_REPO)-backend:$($env:IMAGE_TAG)"
                        $frontendImg = "$($env:DOCKER_HUB_REPO)-frontend:$($env:IMAGE_TAG)"
                        $backendLatest = "$($env:DOCKER_HUB_REPO)-backend:latest"
                        $frontendLatest = "$($env:DOCKER_HUB_REPO)-frontend:latest"

                        Write-Host "Pushing backend image ($backendImg)..."
                        docker push $backendImg
                        if ($LASTEXITCODE -ne 0) { throw "Pushing $backendImg failed" }

                        Write-Host "Pushing backend:latest..."
                        docker push $backendLatest
                        if ($LASTEXITCODE -ne 0) { throw "Pushing $backendLatest failed" }

                        Write-Host "Pushing frontend image ($frontendImg)..."
                        docker push $frontendImg
                        if ($LASTEXITCODE -ne 0) { throw "Pushing $frontendImg failed" }

                        Write-Host "Pushing frontend:latest..."
                        docker push $frontendLatest
                        if ($LASTEXITCODE -ne 0) { throw "Pushing $frontendLatest failed" }

                        Write-Host "Logging out of Docker Hub..."
                        docker logout
                    '''
                }
            }
        }

        // ====================================================================
        // Stage 15: Deployment
        // ====================================================================
        stage('Deployment') {
            stages {
                // Development / Staging Deployment
                stage('Deploy to Staging') {
                    when {
                        not { branch 'main' }
                    }
                    steps {
                        echo "--> [Stage 15A] Deploying feature branch to Staging environment..."
                        powershell '''
                            $ErrorActionPreference = 'Stop'
                            Write-Host "Deploying Staging environment via docker-compose.dev.yml..."
                            docker compose -f docker-compose.dev.yml up -d --build
                            if ($LASTEXITCODE -ne 0) {
                                throw "Staging docker compose deployment failed with exit code $LASTEXITCODE"
                            }
                            Write-Host "Staging environment deployed and running."
                        '''
                    }
                }

                // Production Deployment with Gate Approval
                stage('Production Approval & Deploy') {
                    when {
                        branch 'main'
                    }
                    steps {
                        echo "--> [Stage 15B] Production deployment gate requested."
                        timeout(time: 24, unit: 'HOURS') {
                            input message: "Approve deployment of ${IMAGE_TAG} to Production?",
                                  ok: "Deploy to Production"
                        }
                        echo "Gate approved. Deploying to Production cluster..."
                        powershell '''
                            $ErrorActionPreference = 'Stop'
                            Write-Host "Deploying Production stack via docker-compose.yml..."
                            docker compose -f docker-compose.yml up -d --build
                            if ($LASTEXITCODE -ne 0) {
                                throw "Production docker compose deployment failed with exit code $LASTEXITCODE"
                            }

                            Write-Host "Verifying production health check on http://localhost:8000/health..."
                            $maxRetries = 15
                            $healthy = $false
                            for ($i = 1; $i -le $maxRetries; $i++) {
                                try {
                                    $response = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get -TimeoutSec 5 -ErrorAction Stop
                                    if ($response.status -eq "ok" -or $response.status -eq "healthy") {
                                        Write-Host "Health check response: $($response | ConvertTo-Json -Compress)"
                                        $healthy = $true
                                        break
                                    }
                                } catch {
                                    Write-Host "Attempt $i of $maxRetries - service not ready yet ($($_.Exception.Message)). Waiting 3 seconds..."
                                    Start-Sleep -Seconds 3
                                }
                            }

                            if (-not $healthy) {
                                throw "HEALTH CHECK FAILED: http://localhost:8000/health did not return healthy status within $($maxRetries * 3) seconds."
                            }
                            Write-Host "Production deployment verified and active!"
                        '''
                    }
                }
            }
        }
    }

    post {
        always {
            echo "Pipeline run completed. Cleaning temporary build workspaces..."
            cleanWs deleteDirs: true, notFailBuild: true
        }
        success {
            echo "CI/CD Pipeline succeeded! Build: ${env.BUILD_NUMBER} (${IMAGE_TAG})."
        }
        failure {
            echo "CI/CD Pipeline failed! Check logs above for stage failure."
        }
    }
}
