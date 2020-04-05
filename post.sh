#!/bin/sh
cd "$(dirname "$0")"
. ./info.sh
cat << EOF > work/BuildData/info.json
{
	"minecraftVersion": "$minecraftversion",
	"serverUrl": "$minecraftserverurl",
	"minecraftHash": "$minecraftservermd5sum",
	"accessTransforms": "bukkit-$minecraftversion.at",
	"classMappings": "bukkit-$minecraftversion-cl.csrg",
	"memberMappings": "bukkit-$minecraftversion-members.csrg",
	"packageMappings": "package.srg",
	"classMapCommand": "java -jar BuildData/bin/SpecialSource-2.jar map --only . --only net/minecraft --auto-lvt BASIC --auto-member SYNTHETIC -e BuildData/mappings/bukkit-$minecraftversion.exclude -i {0} -m {1} -o {2}",
	"memberMapCommand": "java -jar BuildData/bin/SpecialSource-2.jar map --only . --only net/minecraft --auto-member LOGGER --auto-member TOKENS -i {0} -m {1} -o {2}",
	"finalMapCommand": "java -jar BuildData/bin/SpecialSource.jar --only . --only net/minecraft -i {0} --access-transformer {1} -m {2} -o {3}",
	"decompileCommand": "java -jar BuildData/bin/fernflower.jar -dgs=1 -hdc=0 -asc=1 -udv=0 -rsy=1 -aoa=1 {0} {1}",
	"toolsVersion": 105
}
EOF
mv "work/BuildData/mappings/bukkit-$baseminecraftversion.at" "work/BuildData/mappings/bukkit-$minecraftversion.at"
rm -fr work/BuildData/mappings/*"$baseminecraftversion"* work/BuildData/.git
