#!/usr/bin/env sh
# Example shell-command tracker for Statusline Kit.
# Configure in ~/.gemini/statusline-kit/config.json under `customTrackers`:
#   { "type": "command", "id": "clock", "command": "/path/to/clock-tracker.sh", "icon": "🕒", "color": "gray" }
date +"%H:%M"
