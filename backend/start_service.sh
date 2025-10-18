#!/bin/bash
#
# Pawnrepo Service Wrapper Script
# This wrapper handles paths with spaces for systemd compatibility
#

cd "/mnt/c/Users/seji lamina/Desktop/pawn-repo/backend"

# Activate virtual environment
source "/mnt/c/Users/seji lamina/Desktop/pawn-repo/backend/env/bin/activate"

# Run uvicorn
exec uvicorn app.app:app --host 0.0.0.0 --port 8000 --workers 4
