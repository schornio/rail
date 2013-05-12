#!/bin/bash

OUT_DIR="./out/"
SRC_DIR="./src/"

#if [ -d "$OUT_DIR" ]; then
#    rm -r "$OUT_DIR"
#fi

#mkdir "$OUT_DIR"

coffee -c -o "$OUT_DIR" "$SRC_DIR"

cp "$SRC_DIR"/package.json "$OUT_DIR"/package.json
cp ./readme.mdown "$OUT_DIR"/readme.mdown