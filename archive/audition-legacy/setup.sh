#!/bin/bash

echo "🚀 Setting up Teacher Audition system..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Integrate with HTML
echo "🔗 Integrating with index.html..."
node integrate-html.js

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Load real training scaler into window.ModelArtifacts.teacherScaler"
echo "2. Update your audition button to call window.runTeacherAudition(charts)"
echo "3. Test with: console.log('Scaler loaded:', window.ModelArtifacts.teacherScaler)"
echo ""
echo "🔍 Check console for:"
echo "- [FeatureEncoder] Initialized with FEATURE_LEN=46"
echo "- [Teacher] Scaler verified: x_mean[0..2]=[...]"
