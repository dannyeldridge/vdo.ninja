#!/bin/sh
# Cloudflare Pages build command: `sh echobend/build.sh`, output directory `/`.
# Runs on Cloudflare's own clone of the repo, never on a working copy.
set -e
cd "$(dirname "$0")/.."
# Over the Pages 25 MiB per-file limit; an optional background-effects model we don't use.
rm -f thirdparty/longpipe/models/v/*/model_xl.bin
# Local tooling (tests, dev server) has no business being served.
rm -rf echobend
