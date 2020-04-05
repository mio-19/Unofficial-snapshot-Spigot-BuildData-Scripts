#!/bin/sh
set -e
cd "$(dirname "$0")"
./initModules.sh
./gen_current_spigot_mappings.sh
./post.sh
