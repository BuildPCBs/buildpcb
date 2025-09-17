#!/bin/bash

echo "🔧 Vercel Deployment Fix Script"
echo "================================="

# Clean build artifacts
echo "🧹 Cleaning build artifacts..."
rm -rf .next
rm -rf node_modules/.cache

# Install dependencies fresh
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building project..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "📋 Next steps for Vercel deployment:"
    echo "1. Push these changes to your repository"
    echo "2. Vercel should automatically redeploy"
    echo "3. If issues persist, try a manual redeploy from Vercel dashboard"
    echo "4. Clear Vercel's build cache if needed"
else
    echo "❌ Build failed!"
    exit 1
fi
