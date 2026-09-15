#!/usr/bin/env bash
# Sobe o Second Brain localmente em http://127.0.0.1:8765
cd "$(dirname "$0")/app"
python3 server.py "$@"
