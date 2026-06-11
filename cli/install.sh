#!/usr/bin/env bash
# Install `exp` into ~/.local/bin (Linux & macOS). No root needed.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bin_dir="${HOME}/.local/bin"
target="${bin_dir}/exp"

if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js is required (>= 18.3). Install it first." >&2
  exit 1
fi

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "${node_major}" -lt 18 ]; then
  echo "✗ Node ${node_major} is too old; need >= 18.3." >&2
  exit 1
fi

mkdir -p "${bin_dir}"
chmod +x "${here}/bin/exp.js"
ln -sf "${here}/bin/exp.js" "${target}"

echo "✓ Linked ${target} -> bin/exp.js"
if ! echo ":${PATH}:" | grep -q ":${bin_dir}:"; then
  echo "⚠ ${bin_dir} is not on your PATH. Add this to your shell profile:"
  echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
fi
echo "Next: exp config"
