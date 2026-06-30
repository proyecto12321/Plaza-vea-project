pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            
        }
        stage('Verify Files') {
            steps {
                bat 'dir'
                bat 'if exist index.html (echo index.html encontrado) else (echo ERROR: index.html no encontrado && exit /b 1)'
            
    post {
        success {
            echo 'Pipeline exitoso ✅'
        }
        failure {
            echo 'Pipeline fallido ❌'
        }
    }
}
