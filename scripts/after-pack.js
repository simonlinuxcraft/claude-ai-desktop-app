'use strict';
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'linux') return;

  const dir = context.appOutDir;
  const exeName = context.packager.executableName;
  const realPath = path.join(dir, exeName);
  const binPath = path.join(dir, exeName + '.bin');

  if (fs.existsSync(binPath)) return;
  if (!fs.existsSync(realPath)) return;

  fs.renameSync(realPath, binPath);

  const wrapper = `#!/bin/bash
DIR="$(dirname "$(readlink -f "$0")")"

# Snap-Terminals (z.B. alacritty als Snap) vererben GIO_MODULE_DIR auf einen
# Pfad, der hier nicht existiert. Unset, damit glib-basierte Nebenpfade nicht
# auf GDummyTlsBackend zurueckfallen. Chromium selbst ist davon unabhaengig.
# Liegt der Wrapper selbst im Snap, hat der Snap-Starter den Wert richtig gesetzt.
if [ -z "$SNAP" ] || [ "\${DIR#"$SNAP"/}" = "$DIR" ]; then unset GIO_MODULE_DIR; fi

# Unter Wayland laeuft die App nativ, mit --ozone-platform=x11 ueber XWayland. Die Einstellung
# "X11 statt Wayland" setzt das Flag vor "$@", ein eigenes --ozone-platform gewinnt also.
X11=()
grep -qs '"forceX11":true' "\${XDG_CONFIG_HOME:-$HOME/.config}/claude-desktop/window-state.json" && X11=(--ozone-platform=x11)
case " $* " in
  *" --no-sandbox "*) exec "$DIR/${exeName}.bin" "\${X11[@]}" "$@" ;;
  *) exec "$DIR/${exeName}.bin" --no-sandbox "\${X11[@]}" "$@" ;;
esac
`;

  fs.writeFileSync(realPath, wrapper, { mode: 0o755 });
};