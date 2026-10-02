# FotoApp on older Linux (e.g. Ubuntu 18.04)

Found on 2 October 2026 while installing v1.0.3 on an Ubuntu 18.04 machine
(glibc 2.27, libstdc++ GLIBCXX_3.4.25). The AppImage opened, but stopped at the
error page. Two separate packaging problems were behind it.

## 1. Database module needed a newer glibc

The Linux release is built on Ubuntu 22.04. `better_sqlite3.node` was linked
against glibc 2.29 (`log`, `pow`, `exp`, `log2`) and 2.28 (`fcntl64`), so it
cannot load on glibc 2.27. Electron itself only needs glibc 2.25 and was fine.

Fix: `scripts/build-legacy-sqlite.sh` builds better-sqlite3 for Electron in a
`manylinux2014` container (glibc 2.17, GCC 10). The result needs at most
GLIBC_2.14 / GLIBCXX_3.4.18. CI uses it with `--config.npmRebuild=false`, so
electron-builder does not overwrite it.

## 2. libvips was stuck inside app.asar (affected every Linux user)

`asarUnpack` listed `node_modules/sharp/**` but not `node_modules/@img/**`.
`sharp-linux-x64.node` was unpacked automatically, but the library it loads,
`@img/sharp-libvips-linux-x64/lib/libvips-cpp.so.8.17.3`, stayed inside the
asar archive, where the dynamic loader cannot open it:
`ERR_DLOPEN_FAILED: libvips-cpp.so.8.17.3: cannot open shared object file`.
This is not specific to old systems. It was never noticed because development
runs with `start-electron.sh`, not from the packaged app.

Fix: `node_modules/@img/**` added to `asarUnpack`. libvips itself needs glibc
2.25 / GLIBCXX_3.4.22, so it runs on Ubuntu 18.04.

## Guard

`scripts/check-glibc.sh dist/linux-unpacked` fails the CI build when any native
file needs more than glibc 2.27 / GLIBCXX_3.4.25, or when libvips is not
unpacked. It runs before the release is published.

## Error page

`diagnoseError()` in `electron/main.js` used to answer every `ERR_DLOPEN_FAILED`
with "run `npm run rebuild`", which is useless for someone who downloaded the
AppImage. It now recognises a too-old glibc and a missing libvips and explains
them in plain language. The rebuild advice remains for real Node/Electron ABI
mismatches (developers).

## Not supported

Running from source on such a machine: FotoApp needs Node 20+, and the official
Node 20 binaries need glibc 2.28. Use the packaged app instead.

## Remote help

`tools/remote-helper/` is the small copy-paste website that was used to
diagnose this on the old machine from another computer in the same network.
