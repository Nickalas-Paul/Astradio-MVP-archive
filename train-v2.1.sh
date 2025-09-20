#!/bin/bash

echo "🚀 V2.1 Training Pipeline - Dockerized Environment"
echo "=================================================="

# Build the trainer container
echo "📦 Building trainer container..."
docker build -f Dockerfile.trainer -t astradio-trainer .

# Run training in clean environment
echo "🎯 Running V2.1 training..."
docker run --rm \
  -v "$(pwd)/models:/app/models" \
  -v "$(pwd)/datasets:/app/datasets" \
  astradio-trainer

# Verify artifacts were created
echo "✅ Verifying V2.1 artifacts..."
if [ -f "models/student-v2.1/model.json" ] && [ -f "models/student-v2.1/weightfile.bin" ] && [ -f "models/student-v2.1/metadata.json" ]; then
    echo "  ✓ model.json created"
    echo "  ✓ weightfile.bin created" 
    echo "  ✓ metadata.json created"
    
    # Compute checksums
    echo "🔍 Computing artifact checksums..."
    echo "  Model SHA256: $(sha256sum models/student-v2.1/model.json | cut -d' ' -f1)"
    echo "  Weights SHA256: $(sha256sum models/student-v2.1/weightfile.bin | cut -d' ' -f1)"
    echo "  Metadata SHA256: $(sha256sum models/student-v2.1/metadata.json | cut -d' ' -f1)"
    echo "  Dataset SHA256: $(sha256sum datasets/labels/train.jsonl | cut -d' ' -f1)"
    
    echo ""
    echo "🎯 V2.1 Training Complete!"
    echo "  Ready for frozen eval rerun with actual V2.1 model"
    echo "  Artifacts: models/student-v2.1/"
else
    echo "❌ Training failed - artifacts missing"
    exit 1
fi
