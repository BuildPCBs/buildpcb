#!/bin/bash

# BuildPCBs Version Manager
# Simple local script for versioning

set -e

echo "🚀 BuildPCBs Version Manager"
echo "============================"

# Show current status
echo "📊 Current Status:"
echo "Version: $(grep '"version"' package.json | cut -d'"' -f4)"
echo "Last commit: $(git log --oneline -1)"
echo "Commits since last tag: $(git rev-list --count $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~0")..HEAD 2>/dev/null || echo "0")"
echo ""

# Check if there are uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  You have uncommitted changes. Please commit or stash them first."
    exit 1
fi

# Ask user what type of release
echo "What type of release would you like to create?"
echo "1) Patch (bug fixes, small changes) - 0.1.1 → 0.1.2"
echo "2) Minor (new features) - 0.1.1 → 0.2.0"
echo "3) Major (breaking changes) - 0.1.1 → 1.0.0"
echo "4) Just check status (no release)"
echo ""

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo "🔧 Creating patch release..."
        pnpm version:patch
        ;;
    2)
        echo "✨ Creating minor release..."
        pnpm version:minor
        ;;
    3)
        echo "🎯 Creating major release..."
        pnpm version:major
        ;;
    4)
        echo "📊 Status check complete!"
        exit 0
        ;;
    *)
        echo "❌ Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "✅ Release created successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Push to GitHub: git push origin main --follow-tags"
echo "2. Create GitHub release from the new tag"
echo ""
echo "🎉 Done! Your version has been bumped and tagged."
