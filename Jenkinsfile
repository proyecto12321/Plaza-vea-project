pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        stage('Install') {
            steps {
                bat 'npm install'
            }
        }
        stage('Test') {
            steps {
                bat 'npx playwright test'
            }
        }
    }

    post {
        success {
            echo 'Pipeline exitoso ✅'
        }
        failure {
            echo 'Pipeline fallido ❌'
        }
    }
}
