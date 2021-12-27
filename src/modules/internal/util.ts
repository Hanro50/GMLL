import { createHash } from "crypto";
import Fetch from "node-fetch";
import fs from "fs";
import { join } from "path";
import { arch, platform, type, version } from "os";
import { launchArgs, rules } from "../../index.js";
import { execSync } from "child_process";
//import { downloadable } from "./get";
import { cmd as _cmd } from '7zip-min';
import { dir } from "../objects/files.js";


export function getFetch(): (input: RequestInfo, init?: RequestInit) => Promise<Response> {
    return Fetch;
}



export function getOS() {
    const OS = platform();
    switch (OS) {
        case ("win32"):
            return "windows";
        case ("darwin"):
            return "osx"
        default:
            return "linux";
    }
}

const OS = getOS();
/**@deprecated */
export function mkdir(path) {
    if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true, });
}
/**@deprecated */
export function rmdir(target: string) {
    return fs.rmSync(target, { recursive: true, force: true })
}
/**@deprecated */
export function mklink(target: string, path: string) {
    if (fs.existsSync(path)) fs.unlinkSync(path)
    fs.symlinkSync(target, path, "junction");
}

export function lawyer(rules: rules, properties: any = {}): boolean {
    let end = true, end2 = false;
    for (let i = 0; i < rules.length; i++) {
        if (rules[i].features) Object.keys(rules[i].features).forEach(e => {
            if (rules[i].features[e] && !properties[e])
                end = false;
        })
        const os = !rules[i].os || (
            (!rules[i].os.name || rules[i].os.name == OS) &&
            (!rules[i].os.version || version().match(rules[i].os.version)) &&
            (!rules[i].os.arch || (rules[i].os.arch == arch() || (arch() == "x32" && rules[i].os.arch == "x86"))))
        if (rules[i].action == "disallow" && os) {
            end = false;
        }
        else if (rules[i].action == "allow" && os) {
            end = true && end;
            end2 = true;
        }
    }
    return (end && end2);
}
export const defJVM: launchArgs = [
    { "rules": [{ "action": "allow", "os": { "name": "osx" } }], "value": ["-XstartOnFirstThread"] },
    { "rules": [{ "action": "allow", "os": { "name": "windows" } }], "value": "-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump" },
    { "rules": [{ "action": "allow", "os": { "name": "windows", "version": "^10\\." } }], "value": ["-Dos.name=Windows 10", "-Dos.version=10.0"] },
    { "rules": [{ "action": "allow", "os": { "arch": "x86" } }], "value": "-Xss1M" },
    "-Djava.library.path=${natives_directory}",
    "-Dminecraft.launcher.brand=${launcher_name}",
    "-Dminecraft.launcher.version=${launcher_version}",
    "-cp",
    "${classpath}"
]

export const oldJVM = ["-Dhttp.proxyHost=betacraft.pl", "-Djava.util.Arrays.useLegacyMergeSort=true"]
export function parseArguments(val = {}, args: launchArgs = defJVM) {
    let out = ""
    args.forEach(e => {
        if (typeof e == "string")
            out += " " + e.trim().replace(/\s/g, "");
        else if (lawyer(e.rules, val))
            out += " " + (e.value instanceof Array ? e.value.join("\t") : e.value);
    })
    return out
}


/**@deprecated */ /*
export function chkLoadSave<T>(url: string, file: string, sha1: string, size?: number): Promise<T> {
    chkFileDownload

    if (!compare({ key: file, path: file, sha1: sha1, size: size }, true)) {
        return loadSave(url, file, true);
    }
    return JSON.parse(fs.readFileSync(file).toString());
}
/**@deprecated */
/*
export function compare(o: Partial<downloadable>, json = false) {
    const loc = o.name ? join(o.path, o.name) : o.path;
    if (!fs.existsSync(loc)) return false;

    let stats: { size: number };
    let jfile: string;
    if (json) {
        jfile = JSON.stringify(JSON.parse(fs.readFileSync(loc).toString()));
        stats = { size: jfile.length }

    }
    else stats = fs.statSync(loc);
    if (o.size && stats.size != o.size) {
        if (stats.size > 0) console.log("[GMLL]: " + stats.size + " vs " + o.size + " : " + o.key);
        return false;
    }
    if (o.sha1) {
        const sha1 = createHash('sha1').update(jfile ? jfile : fs.readFileSync(loc)).digest("hex");
        let checksums: string[] = [];
        if (typeof o.sha1 == "string") checksums.push(o.sha1); else checksums = o.sha1;

        for (var chk = 0; chk < checksums.length; chk++) {
            if (checksums[chk] == sha1) return true;

        }
        console.log("[GMLL]: " + sha1 + " vs " + o.sha1 + " : " + o.key);
        return false;
    }
    return true;
}
/**@deprecated */
export function loadSave<T>(url: string, file: string, strict = false): Promise<T> {
    return new Promise(async res => {
        let data: T;
        try {
            const rg = await Fetch(url);
            if (rg.status == 200) {
                if (strict) {
                    const text = await rg.text();
                    write(file, text);
                    data = JSON.parse(text);
                }
                else {
                    data = await rg.json() as T;
                    writeJSON(file, data);
                }
                res(data);
            }
        } catch (e) {
            console.log(getErr(e));
        }
        res(JSON.parse(fs.readFileSync(file).toString()) as T);
    })
}
/**
 * Generates the sha1 dir listings for assets and compressed runtime files 
 */
export function assetTag(path: dir, sha1: string) {
    const file = path.getDir(sha1.substr(0, 2));
    file.mkdir()
    return file;
}

export function fsSanitiser(text: string) {
    return text.normalize("NFKC").trim().toLowerCase().replace(/[\,\!\@\#\$\%\^\&\*\(\)\[\]\{\}\;\:\"\<\>\\\/\?\~\`\'\|\=\+\s\t]/g, "_")
}
/**@deprecated */
export function chmod(dir: string) {
    if (type() != "Windows_NT")
        execSync('chmod +x ' + dir)
}
/**@deprecated */

export function stringify(json: object) {
    //@ts-ignore
    return JSON.stringify(json, "\n", "\t");
}
/**@deprecated */
export function write(file: string, json: string) {
    if (fs.existsSync(file)) {
        //Here for people with SSDs to save on write cycles
        if (fs.readFileSync(file).toString() == json) return;
        fs.rmSync(file);
    }
    fs.writeFileSync(file, json);
}
/**@deprecated */
export function writeRAW(file: string, data: Object | Object[]) {
    write(file, JSON.stringify(data));

}
/**@deprecated */
export function writeJSON(file: string, data: Object | Object[]) {
    write(file, stringify(data));

}
/**Used to throw error messages that are easy to find in a busy terminal */
export function getErr(message: any) {
    const header = "\n\n\x1b[31m\x1b[1m[--------------ERROR--------------ERROR--------------!GMLL!--------------ERROR--------------ERROR--------------]\x1b[0m\n\n";
    return header + message + header;
}
/**Used to throw error messages that are easy to find in a busy terminal */
export function throwErr(message: any) {
    throw getErr(message);
}

export function classPathResolver(name: string) {
    const namespec = name.split(":");
    //console.log(namespec[0].replace(/\./g, "/") + "/" + namespec[1] + "/" + namespec[2] + "/" + namespec[1] + "-" + namespec[2] + ".jar")
    return namespec[0].replace(/\./g, "/") + "/" + namespec[1] + "/" + namespec[2] + "/" + namespec[1] + "-" + namespec[2] + ".jar";
}

/*
export async function mutator(o: downloadable, main: boolean = false): Promise<downloadable> {
    try {
        var path = o.path;
        var name = o.name;
        if (main)
            mkdir(path)
        else if (!fs.existsSync(path)) {
            console.error("[GMLL] Does not exist", path);
            return o;
        }
        if (o.unzip) {
            if (o.unzip.path) {
                var com = ['x', join(path, name), '-y', '-o' + o.unzip.path]
                if (o.unzip.exclude) {
                    o.unzip.exclude.forEach(e => {
                        var f = String(e);
                        if (f.endsWith("/")) f += "*"
                        com.push("-xr!" + f);
                    })
                }
                await new Promise<void>(e => _cmd(com, (err: any) => { if (err) console.log(err); e() }));
                if (o.unzip.name)
                    name = o.unzip.name;
                path = o.unzip.path
            }
        }
        if (o.executable) {
            chmod(join(path, name));
        }

        o.path = path;
        o.name = name;

        return o;
    } catch (e) { }
}

/**@deprecated */
/*
export async function chkFileDownload(o: downloadable): Promise<Buffer> {
    if (!compare(o)) await new Promise(e => {
        mkdir(o.path);
        const file = fs.createWriteStream(join(o.path, o.name))
        Fetch(o.url).then(res => {
            if (!res.ok) throw res; 
            res.body.pipe(file, { end: true });
            file.on("close", e);
        })
    });
    o = await mutator(o, true);
    return fs.readFileSync(join(o.path, o.name));
}

/**@deprecated */
/*
export function chkFileDownload2(url: string, name: string, path: string, sha1: string, size?: number): Promise<Buffer> {
    return chkFileDownload({ key: name, url: url, name: name, path: path, sha1: sha1, size: size })
}
*/
