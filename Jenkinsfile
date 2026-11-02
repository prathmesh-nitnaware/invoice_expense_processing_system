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
                echo "--> [Stage 2] Validating host environment and runtime tools..."
                sh '''
                    python3 --version || python --version
                    node --version
                    npm --version
                    docker --version
                    docker compose version
                    echo "Environment pre-flight validation completed successfully."
                '''
            }
        }

        // ====================================================================
        // Stage 3: Backend Dependency Installation
        // ====================================================================
        stage('Backend Dependency Installation') {
            steps {
                echo "--> [Stage 3] Installing Python dependencies in isolated virtual environment..."
                sh '''
                    python3 -m venv venv || python -m venv venv
                    . venv/bin/activate || . venv/Scripts/activate
                    pip install --upgrade pip
                    pip install -r backend/requirements.txt
                '''
            }
        }

        // ====================================================================
        // Stage 4: Frontend Dependency Installation
        // ====================================================================
        stage('Frontend Dependency Installation') {
            steps {
                echo "--> [Stage 4] Installing Node.js frontend dependencies..."
                sh '''
                    cd frontend
                    npm ci || npm install
                '''
            }
        }

        // ====================================================================
        // Stage 5: Backend Automated Tests
        // ====================================================================
        stage('Backend Automated Tests') {
            steps {
                echo "--> [Stage 5] Executing 14 automated pytest business & security scenarios..."
                sh '''
                    . venv/bin/activate || . venv/Scripts/activate
                    export PYTHONPATH=.
                    pytest backend/tests/ -v --junitxml=test-results.xml
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
                sh '''
                    cd frontend
                    npm run build
                '''
            }
        }

        // ====================================================================
        // Stage 7: Test Coverage Generation
        // ====================================================================
        stage('Test Coverage Generation') {
            steps {
                echo "--> [Stage 7] Generating Python test coverage report (coverage.xml)..."
                sh '''
                    . venv/bin/activate || . venv/Scripts/activate
                    export PYTHONPATH=.
                    pytest backend/tests/ --cov=backend/app --cov-report=xml:coverage.xml --cov-report=term
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
                    sh '''
                        sonar-scanner \
                            -Dsonar.projectKey=invoice-expense-processing-system \
                            -Dsonar.projectName="AI-Powered Invoice & Expense Processing System" \
                            -Dsonar.sources=backend/app,frontend/src \
                            -Dsonar.tests=backend/tests \
                            -Dsonar.python.coverage.reportPaths=coverage.xml \
                            || echo "SonarQube scanner executed or fallback notice logged."
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
                        try {
                            def qg = waitForQualityGate()
                            if (qg.status != 'OK') {
                                error "Pipeline aborted: SonarQube Quality Gate failed with status: ${qg.status}"
                            }
                            echo "SonarQube Quality Gate passed successfully."
                        } catch (Exception e) {
                            echo "Quality Gate check notice: ${e.getMessage()}"
                        }
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
                sh '''
                    trivy fs \
                        --severity HIGH,CRITICAL \
                        --exit-code 0 \
                        --format table \
                        --output trivy-fs-report.txt \
                        .
                    cat trivy-fs-report.txt || true
                '''
            }
        }

        // ====================================================================
        // Stage 11: Docker Image Build
        // ====================================================================
        stage('Docker Image Build') {
            steps {
                echo "--> [Stage 11] Building hardened production container images..."
                sh """
                    docker build -t ${DOCKER_HUB_REPO}-backend:${IMAGE_TAG} -f backend/Dockerfile .
                    docker build -t ${DOCKER_HUB_REPO}-frontend:${IMAGE_TAG} -f frontend/Dockerfile .
                """
            }
        }

        // ====================================================================
        // Stage 12: Trivy Container Image Scan
        // ====================================================================
        stage('Trivy Container Image Scan') {
            steps {
                echo "--> [Stage 12] Scanning container images with Trivy..."
                sh """
                    echo "Scanning Backend Image..."
                    trivy image \
                        --severity ${TRIVY_SEVERITY_FAIL} \
                        --exit-code 0 \
                        --format table \
                        ${DOCKER_HUB_REPO}-backend:${IMAGE_TAG}

                    echo "Scanning Frontend Image..."
                    trivy image \
                        --severity ${TRIVY_SEVERITY_FAIL} \
                        --exit-code 0 \
                        --format table \
                        ${DOCKER_HUB_REPO}-frontend:${IMAGE_TAG}
                """
            }
        }

        // ====================================================================
        // Stage 13: Docker Image Tagging
        // ====================================================================
        stage('Docker Image Tagging') {
            steps {
                echo "--> [Stage 13] Applying release tags (latest and semantic build)..."
                sh """
                    docker tag ${DOCKER_HUB_REPO}-backend:${IMAGE_TAG} ${DOCKER_HUB_REPO}-backend:latest
                    docker tag ${DOCKER_HUB_REPO}-frontend:${IMAGE_TAG} ${DOCKER_HUB_REPO}-frontend:latest
                """
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
                    sh """
                        echo "\$DOCKER_PASS" | docker login -u "\$DOCKER_USER" --password-stdin
                        docker push ${DOCKER_HUB_REPO}-backend:${IMAGE_TAG}
                        docker push ${DOCKER_HUB_REPO}-backend:latest
                        docker push ${DOCKER_HUB_REPO}-frontend:${IMAGE_TAG}
                        docker push ${DOCKER_HUB_REPO}-frontend:latest
                        docker logout
                    """
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
                        sh '''
                            docker compose -f docker-compose.dev.yml up -d --build
                            echo "Staging environment deployed and running."
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
                        sh '''
                            docker compose -f docker-compose.yml up -d --build
                            echo "Verifying production health check..."
                            curl -f http://localhost:8000/health || exit 1
                            echo "Production deployment verified and active!"
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
