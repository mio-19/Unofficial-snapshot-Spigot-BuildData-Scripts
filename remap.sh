#!/bin/sh
cd "$(dirname "$0")"
. ./info.sh
basedir="$(pwd)"
workdir="$basedir/work"
accesstransforms="$workdir/BuildData/mappings/""bukkit-$baseminecraftversion.at"
classmappings="$workdir/BuildData/mappings/""bukkit-$minecraftversion-cl.csrg"
membermappings="$workdir/BuildData/mappings/""bukkit-$minecraftversion-members.csrg"
packagemappings="$workdir/BuildData/mappings/""package.srg"
decompiledir="$workdir/Minecraft/$minecraftversion"
jarpath="$decompiledir/$minecraftversion"
mkdir -p "$decompiledir"

echo "Downloading unmapped vanilla jar..."
if [ ! -f  "$jarpath.jar" ]; then
    curl -s -o "$jarpath.jar" "$minecraftserverurl"
    if [ "$?" != "0" ]; then
        echo "Failed to download the vanilla server jar. Check connectivity or try again later."
        rm -f "$jarpath.jar"
        exit 1
    fi
fi

echo "Applying class mappings..."
if [ ! -f "$jarpath-cl.jar" ]; then
    java -jar "$workdir/BuildData/bin/SpecialSource-2.jar" map --only . --only net/minecraft --auto-lvt BASIC --auto-member SYNTHETIC -i "$jarpath.jar" -m "$classmappings" -o "$jarpath-cl.jar" 1>/dev/null
    if [ "$?" != "0" ]; then
        echo "Failed to apply class mappings."
        rm -f "$jarpath-cl.jar"
        exit 1
    fi
fi

echo "Applying member mappings..."
if [ ! -f "$jarpath-m.jar" ]; then
    java -jar "$workdir/BuildData/bin/SpecialSource-2.jar" map --only . --only net/minecraft --auto-member LOGGER --auto-member TOKENS -i "$jarpath-cl.jar" -m "$membermappings" -o "$jarpath-m.jar" 1>/dev/null
    if [ "$?" != "0" ]; then
        echo "Failed to apply member mappings."
        rm -f "$jarpath-m.jar"
        exit 1
    fi
fi

echo "Creating remapped jar..."
if [ ! -f "$jarpath-mapped.jar" ]; then
    java -jar "$workdir/BuildData/bin/SpecialSource.jar" --only . --only net/minecraft -i "$jarpath-m.jar" --access-transformer "$accesstransforms" -m "$packagemappings" -o "$jarpath-mapped.jar" 1>/dev/null
    if [ "$?" != "0" ]; then
        echo "Failed to create remapped jar."
        rm -f "$jarpath-mapped.jar"
        exit 1
    fi
fi

