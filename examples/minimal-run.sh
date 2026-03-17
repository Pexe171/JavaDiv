#!/usr/bin/env bash
set -euo pipefail

npm install
npm run build
npm run dev -- start --target https://example.com --clear-session
