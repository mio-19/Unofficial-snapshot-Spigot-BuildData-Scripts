const request = require('cloudscraper')
const { get } = request
const assert = require('assert').strict
const fs = require('fs')
const util = require('util')
const shell = require('shelljs')
const { URL } = require('url')
const process = require('process')
const { exit } = process
const execa = require('execa')
const getStream = require('get-stream')
const writeFile = util.promisify(fs.writeFile)
const readFile = util.promisify(fs.readFile)
async function read(f) {
    return await readFile(f, 'utf8')
}
const readDir = util.promisify(fs.readdir)
const stat = util.promisify(fs.stat)
const exists = util.promisify(fs.exists)
function shelljs2promise(f) {
    return async function (...args) {
        return await new Promise((resolve, reject) => {
            const result = f(...args)
            return (result.code === 0 || result.code === void 0) ? resolve(result) : reject(result)
        })
    }
}
function isNumeric(num) {
    return !isNaN(num)
}
const pushd = shelljs2promise(shell.pushd)
const popd = shelljs2promise(shell.popd)
const mv = shelljs2promise(shell.mv)
const cp = shelljs2promise(shell.cp)
const rm = shelljs2promise(shell.rm)
const mkdir = shelljs2promise(shell.mkdir)
const chmod = shelljs2promise(shell.chmod)
const sed = shelljs2promise(shell.sed)
const find = shelljs2promise(shell.find)
const touch = shelljs2promise(shell.touch)
const ls = shelljs2promise(shell.ls)
async function execaToStdIO(...args) {
    const r = execa(...args)
    r.stdout.pipe(process.stdout)
    r.stderr.pipe(process.stderr)
    return await r
}
function package_async_program(f) {
    return async () => {
        try {
            await f()
            exit(0)
        } catch (e) {
            console.error(e)
            exit(1)
        }
    }
}
async function with_d(d, f) {
    await pushd(d)
    await f()
    await popd()
}

const builddata_base = '455d45a4244894335cd07451bdda79ccd380aff6' // should be latest commit
const base_version = '1.15.2'
// https://launchermeta.mojang.com/mc/game/version_manifest.json
const base_server_mappings = 'https://launcher.mojang.com/v1/objects/59c55ae6c2a7c28c8ec449824d9194ff21dc7ff1/server.txt'
const current_version = '20w12a'
const current_server_mappings = 'https://launcher.mojang.com/v1/objects/5206e5affa49812606701ec4d6e84b398215e89d/server.txt'
const custom_class_mappings = new Map([
    ["net.minecraft.world.level.levelgen.carver.HellCaveWorldCarver", "net.minecraft.world.level.levelgen.carver.NetherWorldCarver"],
    ["net.minecraft.world.level.levelgen.placement.nether.HellFireDecorator", "net.minecraft.world.level.levelgen.placement.nether.FireDecorator"],
    ["net.minecraft.world.level.block.SoulsandBlock", "net.minecraft.world.level.block.SoulSandBlock"],
    ["net.minecraft.network.protocol.game.ClientboundSetSpawnPositionPacket", "net.minecraft.network.protocol.game.ClientboundSetDefaultSpawnPositionPacket"],
    ["net.minecraft.world.entity.ai.behavior.MakeLove", "net.minecraft.world.entity.ai.behavior.VillagerMakeLove"],
    ["net.minecraft.world.entity.ai.behavior.Celebrate", "net.minecraft.world.entity.ai.behavior.CelebrateVillagersSurvivedRaid"],
    ["net.minecraft.world.entity.ai.behavior.SetWalkTargetAwayFromEntity", "net.minecraft.world.entity.ai.behavior.SetWalkTargetAwayFrom"],
    ["net.minecraft.world.entity.ai.goal.SitGoal", "net.minecraft.world.entity.ai.goal.SitWhenOrderedToGoal"],
    ["net.minecraft.world.entity.monster.PigZombie", "net.minecraft.world.entity.monster.ZombifiedPiglin"],
    ["net.minecraft.world.entity.monster.PigZombie$PigZombieAngerTargetGoal", "net.minecraft.world.entity.monster.ZombifiedPiglin$ZombifiedPiglinAngerTargetGoal"],
    ["net.minecraft.world.entity.monster.PigZombie$PigZombieHurtByOtherGoal", "net.minecraft.world.entity.monster.ZombifiedPiglin$ZombifiedPiglinHurtByOtherGoal"],
    ["net.minecraft.world.level.biome.NetherBiome", "net.minecraft.world.level.biome.NetherWastesBiome"],
])
const custom_fields_mappings = new Map([
    ["Biomes", new Map([
        ["NETHER", "NETHER_WASTES"]
    ])],
    ["Items", new Map([
        ["ZOMBIE_PIGMAN_SPAWN_EGG", "ZOMBIFIED_PIGLIN_SPAWN_EGG"]
    ])],
    ["SoundEffects", new Map([
        ["ENTITY_ZOMBIE_PIGMAN_AMBIENT", "ZOMBIFIED_PIGLIN_AMBIENT"],
        ["ENTITY_ZOMBIE_PIGMAN_ANGRY", "ZOMBIFIED_PIGLIN_ANGRY"],
        ["ENTITY_ZOMBIE_PIGMAN_DEATH", "ZOMBIFIED_PIGLIN_DEATH"],
        ["ENTITY_ZOMBIE_PIGMAN_HURT", "ZOMBIFIED_PIGLIN_HURT"]
    ])],
    ["EntityTypes", new Map([
        ["ZOMBIE_PIGMAN", "ZOMBIFIED_PIGLIN"]
    ])]
])
const current_class_mappings_filter = (id, obf) => {
    // duplicate VillagePlaceType PointOfInterestType: avq
    if (id === 'VillagePlaceType' && obf === 'avq') {
        return false
    }
    return true
}
const mojang_id_transform = new Map() // will be written by some codes
const mojang_name_mapping = x => {
    assert(!x.includes('['))
    assert(!x.includes('/'))
    const result = x.split('.').pop()
    if (result === 'SkullBlock$Type') {
        // spigot call "net.minecraft.world.level.block.SkullBlock$Types" "BlockSkull$Type"
        return `BlockSkull$AType`
    }
    for (const [mojang, id] of mojang_id_transform) {
        if (x.startsWith(mojang + '$')) {
            return x.replace(mojang + '$', id + '$')
        }
    }
    return result
}
const custom_default_fields_filter = (classid, id, obf) => {
    if (id.startsWith('METHOD ') && obf.split(' ').pop() === 'a') {
        return false
    }
    return true
}
async function parse_base_spigot_mappings() {
    const clas = (await read(`work/BuildData/mappings/bukkit-${base_version}-cl.csrg`))
        .split('\n')
        .filter(x => x !== '' && !x.startsWith('#'))
        .map(x => {
            assert(!x.includes("\r"))
            const r = x.split(' ')
            assert.equal(r.length, 2)
            return r
        })
    clas.push(['MinecraftServer', 'MinecraftServer'])
    const methods_fields = (await read(`work/BuildData/mappings/bukkit-${base_version}-members.csrg`))
        .split('\n')
        .filter(x => x !== '' && !x.startsWith('#'))
        .map(x => x.replace(/net\/minecraft\/server\//gi, ''))
        .map(x => {
            assert(!x.includes("\r"))
            return x.split(' ')
        })
    const fields = methods_fields.filter(x => x.length === 3)
    fields.forEach(x => x.forEach(e => assert(!e.includes('('))))
    const methods = methods_fields.filter(x => x.length !== 3)
    methods.forEach(x => {
        assert(x.length, 4)
        assert(x[2].includes('('), `ILLEGAL TYPE ${x[2]}`)
    })
    return { class_mappings: clas, fields_mappings: fields, methods_mappings: methods }
}
async function get_parse_proguard_mappings(url) {
    const lines = (await get(url))
        .split('\n')
        .filter(x => x !== '' && !x.startsWith('#'))
    const blocks = []
    while (lines.length != 0) {
        const line = lines.shift()
        assert.equal(typeof line, 'string')
        assert(!line.includes("\r"))
        if (line.startsWith(' ')) {
            assert(blocks.length != 0)
            blocks[blocks.length - 1].push(line)
        } else {
            assert(line.endsWith(':'))
            blocks.push([line])
        }
    }
    return blocks.map(blk => {
        const clas = blk.shift()
        assert(clas.endsWith(':'))
        const clas1 = clas.split(':')
        assert(clas1.length === 2 && clas1[1] === '')
        const clas_map = clas1[0].split(' -> ')
        assert.equal(clas_map.length, 2)
        if (clas_map[1] === 'net.minecraft.server.MinecraftServer') {
            clas_map[1] = 'MinecraftServer'
            assert(clas_map[0] === 'net.minecraft.server.MinecraftServer')
        }
        return [
            clas_map[1],
            clas_map[0],
            blk
                .filter(x => !x.includes('('))
                .map(x => {
                    const xs = x.split(' ').filter(x => x !== '')
                    assert.equal(xs.length, 4)
                    assert.equal(xs[2], '->')
                    return [xs[3], xs[1]]
                }),
            blk
                .filter(x => x.includes('(') && !(x.includes('init>')))
                .map(x => {
                    const xs = x.split(':')
                    const body = xs.pop()
                    xs.forEach(x => Array.from(x).forEach(c => assert(" 0123456789".includes(c))))
                    const bodies = body.split(' ').filter(x => x !== '')
                    assert.equal(bodies.length, 4)
                    const [ret, idtype, arrow, obf] = bodies
                    assert.equal(arrow, '->')
                    const idtyp_s = idtype.split('(')
                    assert.equal(idtyp_s.length, 2)
                    const id = idtyp_s[0]
                    assert(idtyp_s[1].endsWith(')'))
                    const typ = idtyp_s[1].substring(0, idtyp_s[1].length - 1)
                    return [obf, ret, typ, id]
                })]
    })
}
const javatype_jvmsig_prim_map = [
    ['boolean', 'Z'],
    ['byte', 'B'],
    ['char', 'C'],
    ['short', 'S'],
    ['int', 'I'],
    ['long', 'J'],
    ['float', 'F'],
    ['double', 'D'],
    ['void', 'V']
]
function java_type_to_jvm_sig(x) {
    assert(!x.includes('('))
    assert(!x.includes(')'))
    for (const [java, jvm] of javatype_jvmsig_prim_map) {
        if (x === java) {
            return jvm
        }
    }
    if (x.endsWith('[]')) {
        return '[' + java_type_to_jvm_sig(x.substring(0, x.length - 2))
    } else {
        assert.notEqual(x, '')
        assert(!x.includes('/'))
        return 'L' + x.replace(/\./gi, '/') + ';'
    }
}
function java_method_to_jvm_sig(ret, args) {
    if (args == '') {
        return '()' + java_type_to_jvm_sig(ret)
    }
    return '(' + args.split(',').map(java_type_to_jvm_sig).join('') + ')' + java_type_to_jvm_sig(ret)
}
function allow_more_char_jvm_sig_to_java_type(x) {
    assert(!x.includes('('))
    assert(!x.includes(')'))
    for (const [java, jvm] of javatype_jvmsig_prim_map) {
        if (x.startsWith(jvm)) {
            assert.equal(jvm.length, 1)
            return [java, x.slice(1)]
        }
    }
    if (x.startsWith('[')) {
        const [self, more] = allow_more_char_jvm_sig_to_java_type(x.slice(1))
        return [self + '[]', more]
    } else {
        const xs = x.split(';')
        assert(xs.length > 0)
        const head = xs.shift()
        const more = xs.join(';')
        assert(!head.includes('.'))
        assert(head.startsWith('L'), `ILLEGAL STATE ${head} ${more}`)
        return [head.slice(1).replace(/\//gi, '.'), more]
    }
}
function jvm_sig_to_java_type(x) {
    const [r, more] = allow_more_char_jvm_sig_to_java_type(x)
    assert.equal(more, '')
    return r
}
function jvm_sig_to_java_method(sig) {
    assert(sig.startsWith('('))
    const args_ret = sig.slice(1).split(')')
    assert(args_ret.length, 2)
    let [args, ret] = args_ret
    const args_result = []
    while (args !== '') {
        const [a, more] = allow_more_char_jvm_sig_to_java_type(args)
        args_result.push(a)
        args = more
    }
    return [jvm_sig_to_java_type(ret), args_result.join(',')]
}
async function gen_current_spigot_mappings() {
    console.log('gen_current_spigot_mappings: get mojang mappings ...')
    const [base_mojang, current_mojang] = await Promise.all([
        get_parse_proguard_mappings(base_server_mappings),
        get_parse_proguard_mappings(current_server_mappings)
    ])
    console.log('gen_current_spigot_mappings: parse spigot mappings ...')
    const base_spigot_mappings = await parse_base_spigot_mappings()
    console.log('gen_current_spigot_mappings: calculate')

    const class_base_id2obf = new Map()
    for (const [obf, id] of base_spigot_mappings.class_mappings) {
        assert.equal(typeof obf, 'string')
        assert.equal(typeof id, 'string')
        // the mapping does has duplicate items
        // bds ItemFireworks
        // bds ItemGoldenAppleEnchanted
        class_base_id2obf.set(id, obf)
    }
    assert(class_base_id2obf.has('MinecraftServer'))
    const class_base_obf2mojang = new Map()
    const class_base_mojang2obf = new Map()
    for (const [obf, mojang, _fields, _methods] of base_mojang) {
        assert(!class_base_obf2mojang.has(obf))
        assert.equal(typeof obf, 'string')
        assert.equal(typeof mojang, 'string')
        class_base_obf2mojang.set(obf, mojang)
        assert(!class_base_mojang2obf.has(mojang))
        class_base_mojang2obf.set(mojang, obf)
    }
    assert(class_base_obf2mojang.has('MinecraftServer'))
    const class_current_mojang2obf = new Map()
    for (const [obf, mojang, _fields, _methods] of current_mojang) {
        assert(!class_current_mojang2obf.has(mojang))
        assert.equal(typeof mojang, 'string')
        assert.equal(typeof obf, 'string')
        class_current_mojang2obf.set(mojang, obf)
    }
    assert(class_current_mojang2obf.has('net.minecraft.server.MinecraftServer'))
    const class_current_id2obf = new Map()
    const class_current_obf2id = new Map()
    for (const [id, base_obf] of class_base_id2obf) {
        try {
            let current_mojang = class_base_obf2mojang.get(base_obf)
            let obf = class_current_mojang2obf.get(current_mojang)
            if (obf === undefined) {
                current_mojang = custom_class_mappings.get(current_mojang)
                obf = class_current_mojang2obf.get(current_mojang)
            }
            assert.equal(typeof id, 'string')
            assert.equal(typeof obf, 'string', `${id} not found`)
            if (current_class_mappings_filter(id, obf)) {
                assert(!class_current_obf2id.has(obf), `duplicate ${id} ${class_current_obf2id.get(obf)}: ${obf}`)
                class_current_obf2id.set(obf, id)
                class_current_id2obf.set(id, obf)
                mojang_id_transform.set(current_mojang, id)
            }
        } catch (e) {
            console.warn(e)
        }
    }
    assert(class_current_id2obf.has('MinecraftServer'))
    assert(class_current_obf2id.has('MinecraftServer'))

    for (const [obf, mojang, _fields, _methods] of current_mojang) {
        if ((!mojang.endsWith('package-info')) && (!class_current_obf2id.has(obf))) {
            const mojid = mojang_name_mapping(mojang)
            assert.equal(typeof mojid, 'string')
            assert(!class_current_id2obf.has(mojid), `duplicate: ${mojid}:${obf}, ${class_current_id2obf.get(mojid)}`)
            class_current_id2obf.set(mojid, obf)
            class_current_obf2id.set(obf, mojid)
        }
    }

    const class_base_obf2id = new Map()
    for (const [obf, id] of base_spigot_mappings.class_mappings) {
        assert.equal(typeof obf, 'string')
        assert.equal(typeof id, 'string')
        // the mapping does has duplicate items
        // asu PointOfInterestType
        // asu VillagePlaceType
        class_base_obf2id.set(obf, id)
    }

    const fields_base_id2obf_byclassid = new Map()
    for (const [classid, obf, id] of base_spigot_mappings.fields_mappings) {
        if (!fields_base_id2obf_byclassid.has(classid)) {
            fields_base_id2obf_byclassid.set(classid, new Map())
        }
        assert(!fields_base_id2obf_byclassid.get(classid).has(id))
        fields_base_id2obf_byclassid.get(classid).set(id, obf)
    }
    for (const [classid, rawobf, typ, rawid] of base_spigot_mappings.methods_mappings) {
        if (!fields_base_id2obf_byclassid.has(classid)) {
            fields_base_id2obf_byclassid.set(classid, new Map())
        }
        const [ret, args] = jvm_sig_to_java_method(typ)
        const obf = `${ret} ${args} ${rawobf}`
        const id = `METHOD ${ret} ${args} ${rawid}`
        assert(!fields_base_id2obf_byclassid.get(classid).has(id),
            `duplicate ${classid}."${id}":${obf};${fields_base_id2obf_byclassid.get(classid).get(id)}`)
        fields_base_id2obf_byclassid.get(classid).set(id, obf)
    }
    assert(fields_base_id2obf_byclassid.has('MinecraftServer'))
    const fields_base_obf2mojang_byclassid = new Map()
    function base_mojang2id(mojangid) {
        if (mojangid.endsWith('[]')) {
            return base_mojang2id(mojangid.substring(0, mojangid.length - 2)) + '[]'
        }
        for (const [prim, _jvm] of javatype_jvmsig_prim_map) {
            if (mojangid === prim) {
                return mojangid
            }
        }
        const r = class_base_obf2id.get(class_base_mojang2obf.get(mojangid))
        if (r === undefined) {
            if (mojangid.startsWith('net.minecraft')) {
                return mojang_name_mapping(mojangid)
            } else {
                return mojangid
            }
        }
        return r
    }
    for (const [obfclass, _mojangclass, fields, methods] of base_mojang) {
        if (class_base_obf2id.has(obfclass)) {
            const classid = class_base_obf2id.get(obfclass)
            assert.equal(typeof classid, 'string')
            assert(!fields_base_obf2mojang_byclassid.has(classid))
            fields_base_obf2mojang_byclassid.set(classid, new Map())
            for (const [obf, id] of fields) {
                assert(!fields_base_obf2mojang_byclassid.get(classid).has(obf))
                fields_base_obf2mojang_byclassid.get(classid).set(obf, id)
            }
            for (const [rawobf, ret, typ, rawid] of methods) {
                const ret_args = `${base_mojang2id(ret)} ${typ.split(',').map(base_mojang2id).join(',')}`
                const obf = `${ret_args} ${rawobf}`
                fields_base_obf2mojang_byclassid.get(classid).set(obf, `METHOD ${ret_args} ${rawid}`)
            }
        }
    }
    assert(fields_base_obf2mojang_byclassid.has('MinecraftServer'))
    const fields_current_mojang2obf_byclassid = new Map()
    function current_mojang2id(mojangid) {
        if (mojangid.endsWith('[]')) {
            return current_mojang2id(mojangid.substring(0, mojangid.length - 2)) + '[]'
        }
        for (const [prim, _jvm] of javatype_jvmsig_prim_map) {
            if (mojangid === prim) {
                return mojangid
            }
        }
        const r = class_current_obf2id.get(class_current_mojang2obf.get(mojangid))
        if (r === undefined && !mojangid.startsWith('net.minecraft')) {
            return mojangid
        }
        assert.equal(typeof r, 'string', `${mojangid} not found`)
        return r
    }
    for (const [obfclass, _mojangclass, fields, methods] of current_mojang) {
        if (class_current_obf2id.has(obfclass)) {
            const classid = class_current_obf2id.get(obfclass)
            assert.equal(typeof classid, 'string')
            assert(!fields_current_mojang2obf_byclassid.has(classid))
            fields_current_mojang2obf_byclassid.set(classid, new Map())
            for (const [obf, id] of fields) {
                assert(!fields_current_mojang2obf_byclassid.get(classid).has(id))
                fields_current_mojang2obf_byclassid.get(classid).set(id, obf)
            }
            for (const [rawobf, ret, typ, rawid] of methods) {
                const ret_args = `${current_mojang2id(ret)} ${typ.split(',').map(current_mojang2id).join(',')}`
                const obf = `${ret_args} ${rawobf}`
                fields_current_mojang2obf_byclassid.get(classid).set(`METHOD ${ret_args} ${rawid}`, obf)
            }
        }
    }
    assert(fields_current_mojang2obf_byclassid.has('MinecraftServer'))
    const fields_current_id2obf_byclassid = new Map()
    const fields_current_obf2id_byclassid = new Map()
    for (const [classid, _current_class_obf] of class_current_id2obf) {
        if (fields_base_id2obf_byclassid.has(classid)) {
            const fields_base_id2obf = fields_base_id2obf_byclassid.get(classid)
            const fields_base_obf2mojang = fields_base_obf2mojang_byclassid.get(classid)
            const fields_current_mojang2obf = fields_current_mojang2obf_byclassid.get(classid)
            const fields_current_id2obf = new Map()
            for (const [id, base_obf] of fields_base_id2obf) {
                try {
                    let obf = fields_current_mojang2obf.get(fields_base_obf2mojang.get(base_obf))
                    if (obf === undefined && custom_fields_mappings.has(classid)) {
                        obf = fields_current_mojang2obf.get(custom_fields_mappings.get(classid).get(id))
                    }
                    assert.equal(typeof obf, 'string', `${classid}."${id}" not found base_obf = ${base_obf}; fields_base_obf2mojang.get(base_obf) = ${fields_base_obf2mojang.get(base_obf)};`)
                    fields_current_id2obf.set(id, obf)
                } catch (e) {
                    console.warn(e)
                }
            }
            const fields_current_obf2id = new Map()
            for (const [k, v] of fields_current_id2obf) {
                try {
                    assert(!fields_current_obf2id.has(v), `duplicate ${classid}."${k}" "${fields_current_obf2id.get(v)}" :${v}`)
                    fields_current_obf2id.set(v, k)
                } catch (e) {
                    console.warn(e)
                }
            }
            assert(!fields_current_id2obf_byclassid.has(classid))
            fields_current_id2obf_byclassid.set(classid, fields_current_id2obf)
            assert(!fields_current_obf2id_byclassid.has(classid))
            fields_current_obf2id_byclassid.set(classid, fields_current_obf2id)
        }
    }
    assert(fields_current_id2obf_byclassid.has('MinecraftServer'))

    for (const [classid, fields_current_mojang2obf] of fields_current_mojang2obf_byclassid) {
        if (!fields_current_id2obf_byclassid.has(classid)) {
            fields_current_id2obf_byclassid.set(classid, new Map())
            assert(!fields_current_obf2id_byclassid.has(classid))
            fields_current_obf2id_byclassid.set(classid, new Map())
        }
        for (const [id, obf] of fields_current_mojang2obf) {
            if ((!fields_current_obf2id_byclassid.get(classid).has(obf))
                && custom_default_fields_filter(classid, id, obf)) {
                fields_current_id2obf_byclassid.get(classid).set(id, obf)
            }
        }
    }

    console.log('gen_current_spigot_mappings: write to file ...')
    let clmap = ''
    for (const [id, obf] of class_current_id2obf) {
        if ('MinecraftServer' !== id && !(id.includes('$') && isNumeric(id.split('$').pop()))) {
            clmap += `${obf} ${id}\n`
        }
    }
    await writeFile(`work/BuildData/mappings/bukkit-${current_version}-cl.csrg`, clmap)
    let memmap = ''
    for (const [classid, fields_current_id2obf] of fields_current_id2obf_byclassid) {
        for (let [id, obf] of fields_current_id2obf) {
            if (obf.includes(' ')) {
                const obf_s = obf.split(' ')
                assert.equal(obf_s.length, 3)
                const [ret, args, rawobf] = obf_s
                obf = `${rawobf} ${java_method_to_jvm_sig(ret, args)}`
                const ids = id.split(' ')
                assert.equal(ids[0], 'METHOD')
                assert.equal(ids.length, 4)
                id = ids.pop()
            }
            assert(!id.includes(' '))
            memmap += `${classid} ${obf} ${id}\n`
                .replace(/^MinecraftServer/gi, 'net/minecraft/server/MinecraftServer')
                .replace(/LMinecraftServer;/gi, 'Lnet/minecraft/server/MinecraftServer;')
        }
    }
    await writeFile(`work/BuildData/mappings/bukkit-${current_version}-members.csrg`, memmap)
    await writeFile(`work/BuildData/mappings/bukkit-${current_version}.exclude`, await read('data-current-exclude.txt'))
}
module.exports = {
    gen_current_spigot_mappings: gen_current_spigot_mappings
}
