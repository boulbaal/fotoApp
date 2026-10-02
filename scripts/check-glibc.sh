#!/usr/bin/env bash
# Fails when any native file in a packaged Linux build needs a newer glibc or
# libstdc++ than the oldest system we support (default: Ubuntu 18.04).
# Usage: scripts/check-glibc.sh [dir] [max-glibc] [max-glibcxx]
set -euo pipefail
DIR=${1:-dist/linux-unpacked}
MAX_GLIBC=${2:-2.27}       # Ubuntu 18.04
MAX_GLIBCXX=${3:-3.4.25}   # Ubuntu 18.04 libstdc++
fail=0
newer() { [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -1)" != "$2" ]; }  # $1 > $2 ?
while IFS= read -r f; do
  syms=$(objdump -T "$f" 2>/dev/null) || continue
  g=$(grep -o 'GLIBC_[0-9.]*' <<<"$syms" | sed 's/GLIBC_//' | sort -Vu | tail -1 || true)
  x=$(grep -o 'GLIBCXX_[0-9.]*' <<<"$syms" | sed 's/GLIBCXX_//' | sort -Vu | tail -1 || true)
  if [ -n "$g" ] && newer "$g" "$MAX_GLIBC"; then echo "TOO NEW: $f needs GLIBC_$g (max $MAX_GLIBC)"; fail=1; fi
  if [ -n "$x" ] && newer "$x" "$MAX_GLIBCXX"; then echo "TOO NEW: $f needs GLIBCXX_$x (max $MAX_GLIBCXX)"; fail=1; fi
done < <(find "$DIR" -type f \( -name '*.node' -o -name '*.so' -o -name '*.so.*' -o -perm -u+x \) ! -name '*.sh' ! -path '*sharp-linuxmusl*')
# sharp loads libvips from app.asar.unpacked; it must not be stuck inside the asar.
if [ -d "$DIR/resources" ] && ! ls "$DIR"/resources/app.asar.unpacked/node_modules/@img/sharp-libvips-linux-x64/lib/libvips-cpp.so.* >/dev/null 2>&1; then
  echo "MISSING: libvips-cpp.so is not unpacked (sharp will fail to load)"; fail=1
fi
[ $fail -eq 0 ] && echo "OK: everything in $DIR runs on glibc $MAX_GLIBC / libstdc++ $MAX_GLIBCXX"
exit $fail
