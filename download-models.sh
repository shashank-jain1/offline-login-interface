#!/bin/bash

# Script to download face-api.js models
# Run this script to set up face recognition models

set -e

echo "🎭 Downloading face-api.js models..."

# Create models directory
mkdir -p public/models

# Base URL for models
BASE_URL="https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master"

# Required models
MODELS=(
  "tiny_face_detector_model-weights_manifest.json"
  "tiny_face_detector_model-shard1"
  "face_landmark_68_model-weights_manifest.json"
  "face_landmark_68_model-shard1"
  "face_recognition_model-weights_manifest.json"
  "face_recognition_model-shard1"
  "face_recognition_model-shard2"
  "ssd_mobilenetv1_model-weights_manifest.json"
  "ssd_mobilenetv1_model-shard1"
  "ssd_mobilenetv1_model-shard2"
)

# Download each model
cd public/models
for model in "${MODELS[@]}"; do
  if [ -f "$model" ]; then
    echo "✓ $model already exists, skipping..."
  else
    echo "⬇️  Downloading $model..."
    curl -L -O "$BASE_URL/$model"
    echo "✓ Downloaded $model"
  fi
done

echo ""
echo "✅ All models downloaded successfully!"
echo "📁 Models location: public/models/"
echo ""
echo "Next steps:"
echo "1. Run 'npm install' to install dependencies"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Navigate to the application and try face recognition!"
