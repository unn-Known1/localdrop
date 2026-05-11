#!/bin/bash

# LocalDrop One-Click Installer & Launcher
echo "🚀 Preparing LocalDrop..."

# Check dependencies
for cmd in git node npm; do
    if ! command -v $cmd &> /dev/null; then
        echo "❌ Error: $cmd is not installed. Please install Node.js and Git first."
        exit 1
    fi
done

# Define installation directory
TARGET_DIR="localdrop-app"

if [ ! -d "$TARGET_DIR" ]; then
    echo "📂 Cloning repository..."
    git clone https://github.com/unn-Known1/localdrop.git "$TARGET_DIR"
fi

cd "$TARGET_DIR" || exit

# Run the launch script
./launch.sh
