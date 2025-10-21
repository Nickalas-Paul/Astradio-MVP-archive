#!/bin/bash

# Astradio UI Development Script
# Starts both the backend and frontend development servers

echo "🚀 Starting Astradio Development Environment"
echo "=============================================="

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v20.12.2"
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "⚠️  Warning: Node.js version is $NODE_VERSION. Recommended: v20.12.2"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build vNext system if needed
if [ ! -d "dist/vnext" ]; then
    echo "🔨 Building vNext system..."
    npm run vnext:build
fi

# Start backend server in background
echo "🔧 Starting backend server on port 3000..."
npm start &
BACKEND_PID=$!

# Wait for backend to start
echo "⏳ Waiting for backend to initialize..."
sleep 5

# Start frontend development server
echo "🎨 Starting frontend development server on port 3001..."
npm run ui:dev &
FRONTEND_PID=$!

echo ""
echo "✅ Development environment started!"
echo "   Backend:  http://localhost:3000"
echo "   Frontend: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop both servers"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping development servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for processes
wait
