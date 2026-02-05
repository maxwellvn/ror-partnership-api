#!/bin/bash
# Sync API to standalone GitHub repo for Coolify deployment

TEMP_REPO="/tmp/ror-partnership-api"
SOURCE_DIR="/Applications/XAMPP/xamppfiles/htdocs/partnership"

echo "Syncing to GitHub repo..."

# Sync source files (excluding package.json which has workspaces config)
cp -r "$SOURCE_DIR/apps/api/src" "$TEMP_REPO/"
cp -r "$SOURCE_DIR/apps/api/scripts" "$TEMP_REPO/" 2>/dev/null || true
cp -r "$SOURCE_DIR/packages/shared" "$TEMP_REPO/packages/"
cp "$SOURCE_DIR/.env.example" "$TEMP_REPO/"
cp "$SOURCE_DIR/apps/api/Dockerfile" "$TEMP_REPO/"
cp "$SOURCE_DIR/apps/api/.dockerignore" "$TEMP_REPO/" 2>/dev/null || true

cd "$TEMP_REPO"

# Commit and push
git add -A
if git diff --staged --quiet; then
    echo "No changes to push"
else
    git commit -m "Sync from source - $(date '+%Y-%m-%d %H:%M')"
    git push
    echo "Pushed to GitHub!"
fi
