#!/usr/bin/env bash
# Builds better-sqlite3 for Electron inside a manylinux2014 container (glibc 2.17)
# and puts the result in node_modules/better-sqlite3/build/Release/.
#
# Why: the regular build runs on Ubuntu 22.04, which links better_sqlite3.node
# against glibc 2.29 (log/pow/exp). Older systems such as Ubuntu 18.04
# (glibc 2.27) then refuse to load the database module and FotoApp stops at
# the error page. Built in manylinux2014 the module only needs glibc 2.14.
#
# Requires: docker, and `npm install` already run (node_modules present).
set -euo pipefail
cd "$(dirname "$0")/.."

ELECTRON_VERSION=$(node -p "require('./node_modules/electron/package.json').version")
SQLITE_VERSION=$(node -p "require('./node_modules/better-sqlite3/package.json').version")
NODE_VERSION=v20.18.0
IMAGE=quay.io/pypa/manylinux2014_x86_64
echo "better-sqlite3 $SQLITE_VERSION for Electron $ELECTRON_VERSION in $IMAGE"

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
cp -r node_modules/better-sqlite3 "$WORK/pkg"
rm -rf "$WORK/pkg/build"

cat > "$WORK/inner.sh" <<INNER
set -euo pipefail
cd /tmp
curl -sSL https://unofficial-builds.nodejs.org/download/release/$NODE_VERSION/node-$NODE_VERSION-linux-x64-glibc-217.tar.xz | tar -xJ
export PATH=/tmp/node-$NODE_VERSION-linux-x64-glibc-217/bin:\$PATH
export PYTHON=/opt/python/cp311-cp311/bin/python3
cd /w/pkg
npx -y node-gyp@10 rebuild --release --target=$ELECTRON_VERSION --arch=x64 \
  --dist-url=https://electronjs.org/headers --devdir=/tmp/gyp > /w/gyp.log 2>&1 \
  || { tail -40 /w/gyp.log; exit 1; }
chown -R $(id -u):$(id -g) /w/pkg/build
INNER

docker run --rm -v "$WORK:/w" "$IMAGE" bash /w/inner.sh

mkdir -p node_modules/better-sqlite3/build/Release
cp "$WORK/pkg/build/Release/better_sqlite3.node" node_modules/better-sqlite3/build/Release/
MAX=$(objdump -T node_modules/better-sqlite3/build/Release/better_sqlite3.node | grep -o 'GLIBC_[0-9.]*' | sort -Vu | tail -1)
echo "Done: better_sqlite3.node needs at most $MAX"
