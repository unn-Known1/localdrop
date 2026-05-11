#!/bin/bash

# LocalDrop Quick Launcher
echo "🚀 Starting LocalDrop..."

# Check if npm is installed
if ! command -v npm &> /dev/null
then
    echo "❌ Error: npm is not installed. Please install Node.js and npm first."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build and start the preview server
echo "🏗️  Building and launching..."
npm start
