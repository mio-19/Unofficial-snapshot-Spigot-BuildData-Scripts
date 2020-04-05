#!/bin/sh
cd "$(dirname "$0")"
exec git submodule update --init --recursive
