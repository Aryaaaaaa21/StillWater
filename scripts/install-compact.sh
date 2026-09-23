#!/usr/bin/env bash
set -euo pipefail

# Install the exact compiler used to produce contracts/managed/stillwater.
# Windows developers should use the WSL Ubuntu toolchain; this script targets
# Linux CI and Linux development shells.
version="0.31.1"
archive="compactc_v${version}_x86_64-unknown-linux-musl.zip"
url="https://github.com/midnightntwrk/compact/releases/download/compactc-v${version}/${archive}"
expected="e291b4bab4d4e857707008f8b1c25c2b8e0c843f6c737d0ee6c0d9ac69a6bbfb"
home_dir="${COMPACT_HOME:-$HOME/.compact}"
tmp_dir="${TMPDIR:-/tmp}"
archive_path="$tmp_dir/$archive"

curl --fail --location --silent --show-error --retry 3 --output "$archive_path" "$url"
actual="$(sha256sum "$archive_path" | awk '{print $1}')"
if [[ "$actual" != "$expected" ]]; then
  echo "Compact compiler archive checksum mismatch: $actual (expected $expected)" >&2
  exit 1
fi
mkdir -p "$home_dir/bin"
unzip -oq "$archive_path" -d "$home_dir/bin"
chmod +x "$home_dir/bin/compactc" "$home_dir/bin/compactc.bin" "$home_dir/bin/zkir" "$home_dir/bin/zkir-v3" "$home_dir/bin/fixup-compact" "$home_dir/bin/format-compact"
"$home_dir/bin/compactc" --version
