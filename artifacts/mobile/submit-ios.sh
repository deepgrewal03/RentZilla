#!/bin/sh
export PATH="/home/runner/.local/bin:$PATH"
echo "Using grep: $(which grep)"
echo "Submitting to App Store Connect..."
eas submit --platform ios --latest
