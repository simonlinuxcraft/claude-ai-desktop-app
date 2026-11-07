#!/bin/bash
# Claude Desktop Launcher
# Findet und startet das AppImage automatisch

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Hoechste vorhandene Version, nicht die alphabetisch erste: liegen mehrere AppImages
# nebeneinander, startete "head -1" sonst eine alte.
APPIMAGE=$(find "$SCRIPT_DIR" -maxdepth 1 -name "Claude-Desktop-*.AppImage" -type f | sort -V | tail -1)

# Sprache erkennen (de = Deutsch, sonst Englisch)
LANG_PREFIX="${LANG%%_*}"
if [ "$LANG_PREFIX" = "de" ] || [ "${LANGUAGE%%:*}" = "de" ]; then
  IS_DE=true
else
  IS_DE=false
fi

if [ -z "$APPIMAGE" ]; then
  if [ "$IS_DE" = true ]; then
    echo "Fehler: Claude-Desktop AppImage nicht gefunden."
  else
    echo "Error: Claude Desktop AppImage not found."
  fi
  exit 1
fi

chmod +x "$APPIMAGE"

# --no-sandbox setzt der Wrapper im AppImage (scripts/after-pack.js).
exec "$APPIMAGE" "$@"
