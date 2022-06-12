import { join } from "path";
import fetch from "node-fetch";
import { existsSync, mkdirSync, unlinkSync, symlinkSync, readFileSync, createWriteStream, statSync, writeFileSync, read, rmSync, readdirSync, copyFileSync, lstatSync } from 'fs';
import { createHash } from "crypto";
import { platform, type } from "os";
import { execSync } from "child_process";
import { cmd as _cmd } from '7zip-min';

export interface downloadable {
    name: string,
    path: string[],
    url: string,

    key: string,
    chk: {
        sha1?: string | string[],
        size?: number
    },
    unzip?: {
        file: string[],

        exclude?: string[]
    },
    executable?: boolean | string,
    dynamic?: boolean

}
/**
 * 
 * @param dest Path to create the link in
 * @param path Path to the file to link to
 */
export function mklink(dest: string, path: string) {
    try {
        if (existsSync(path)) unlinkSync(path)

        symlinkSync(dest, path, "junction");
    } catch (e) {
        console.error(e, existsSync(path), path);
        console.error("Could not create syslink between d:" + dest + "=>p:" + path)
        process.exit()
    }
}


export function mkdir(path: string) {
    if (!existsSync(path)) mkdirSync(path, { recursive: true, });
}

export function stringify(json: object) {
    //@ts-ignore
    return JSON.stringify(json, "\n", "\t");
}
const isWin = platform() == "win32";

export class dir {

    isRelative() {
        if (this.path.length < 1) return true
        if (isWin) return !this.path[0].includes(":");
        return !this.path[0].startsWith("/");
    }

    islink() {
        return lstatSync(this.sysPath()).isSymbolicLink();
    }
    path: string[];
    constructor(...path: string[]) {
        this.path = [];

        if (!isWin && path[0].startsWith("/")) {
            this.path.push("/")
        }
        path.forEach(e => {
            if (isWin)
                e = e.replace(/\\/g, '/')
            this.path.push(...e.split("/"));
        })
        this.path = this.path.filter((el) => {
            return el.length > 0;
        })


    }
    sysPath() {
        if (this.isRelative()) {
            return join(process.cwd(), ...this.path);
        }
        return join(...this.path);
    }
    mkdir() {
        mkdir(join(...this.path));
        return this;
    }
    linkTo(dest: string | string[] | file | dir) {
        if (this instanceof file && platform() == "win32") console.warn("[GMLL]: Symlinks in Windows need administrator priviliges!\nThings are about to go wrong!")
        if (dest instanceof file)
            dest = [...dest.path, dest.name];
        if (dest instanceof dir)
            dest = dest.path;
        if (dest instanceof Array)
            dest = join(...dest);
        mklink(dest, this.sysPath());
    }
    linkFrom(path: string | string[] | file | dir) {
        if (this instanceof file && platform() == "win32") console.warn("[GMLL]: Symlinks in Windows need administrator priviliges!\nThings are about to go wrong!")
        if (path instanceof file)
            path = [...path.path, path.name];
        if (path instanceof dir)
            path = path.path;
        if (path instanceof Array)
            path = join(...path);
        mklink(this.sysPath(), path);
    }
    /**@override */
    toString() {
        return this.sysPath();
    }
    getDir(..._file: string[]) {
        return new dir(...this.path, ..._file);
    }

    getFile(..._file: string[]) {
        return new file(...this.path, ..._file);
    }
    rm() {
        rmSync(this.sysPath(), { recursive: true, force: true })
        return this;
    }
    exists() {
        return existsSync(this.sysPath());
    }
    javaPath() {
        return this.path.join("/");
    }
    ls() {

        let res: Array<dir | file> = [];
        if (this.exists()) {
            readdirSync(this.sysPath()).forEach(e => {
                const stat = statSync(join(this.sysPath(), e));
                res.push(stat.isFile() ? this.getFile(e) : this.getDir(e));
            })
        }
        return res;
    }
    getName() {
        return this.path[this.path.length - 1]
    }
}
export class file extends dir {
    dir(): dir {
        return new dir(...this.path);
    }
    name: string;
    constructor(...path: string[]) {
        super(...path);
        this.name = this.path.pop();
    }

    read(): string {
        return readFileSync(this.sysPath()).toString();
    }
    toJSON<T>() {
        if (this.exists())
            return JSON.parse(readFileSync(this.sysPath()).toString()) as T;
        console.trace();
        throw "No file to read!"
    }
    /**@override */
    getName() {
        return this.name;
    }


    /**@override */
    sysPath() {
        return join(super.sysPath(), this.name);
    }

    /**@override */
    javaPath() {
        return [...this.path, this.name].join("/");
    }
    copyto(file: file) {
        copyFileSync(this.sysPath(), file.sysPath());
    }
    sha1(expected: string | string[]) {
        if (!this.exists()) return false
        const sha1 = this.getHash();
        let checksums: string[] = [];
        if (typeof expected == "string") checksums.push(expected); else checksums = expected;
        for (var chk = 0; chk < checksums.length; chk++) {
            if (checksums[chk] == sha1) return true;
        }
        return false;
    }
    getHash() {
        return createHash('sha1').update(readFileSync(this.sysPath())).digest("hex");
    }
    getSize() {
        return statSync(this.sysPath()).size;
    }
    size(expected: number) {
        if (!this.exists()) return false
        return this.getSize() == expected;
    }
    /**Returns true if the file is in missmatch */
    chkSelf(chk?: { sha1?: string | string[], size?: number }) {
        if (!chk || !this.exists()) return true
        if (chk.sha1 && !this.sha1(chk.sha1)) return true
        if (chk.size && !this.size(chk.size)) return true

        return false;
    }

    async download(url: string, chk?: { sha1?: string | string[], size?: number }) {
        if (this.chkSelf(chk))
            await new Promise((resolve, reject) => {
                const file = createWriteStream(this.sysPath());
                fetch(url).then(res => {
                    if (!res.ok) reject(res.status);
                    res.body.pipe(file, { end: true });
                    file.on("close", resolve);
                }).catch(reject)
            });
        return this;
    }
    chmod() {
        if (type() != "Windows_NT")
            execSync('chmod +x ' + this.sysPath())
    }

    write(data: string | ArrayBuffer | object) {
        if (typeof data == "object")
            data = stringify(data);
        writeFileSync(this.sysPath(), data);
    }
    toDownloadable(url: string, key?: string, chk?: { sha1?: string | string[], size?: number }, opt?: { executable?: boolean | string, unzip?: { file: dir, exclude?: string[] } }) {
        this.mkdir();
        let d: downloadable = { key: key || [...this.path, this.name].join("/"), name: this.name, path: this.path, url: url, chk: {} }
        if (chk) {
            d.chk = chk;
        }
        if (opt) {
            d.executable = opt.executable;
            if (opt.unzip) {
                opt.unzip.file.mkdir();
                d.unzip = { file: opt.unzip.file.path, exclude: opt.unzip.exclude };
            }
        }
        return d;
    }

    static async process(json: downloadable) {
        let f = new this(...json.path, json.name);
        if (json.dynamic && f.exists()) {
            return;
        }
        await f.download(json.url, json.chk);

        if (json.unzip) {
            await f.unzip(new dir(...json.unzip.file), json.unzip.exclude);
        }
        if (json.executable) {
            if (typeof json.executable == "boolean")
                f.chmod();
            else
                new file(json.executable).chmod();

        }
    }
    unzip(path: dir, exclude?: string[]) {
        var com = ['x', this.sysPath(), '-y', '-o' + path.sysPath()]
        if (exclude) {
            exclude.forEach(e => {
                var f = String(e);
                if (f.endsWith("/")) f += "*"
                com.push("-xr!" + f);
            })
        }
        return new Promise<void>(e => _cmd(com, (err: any) => { if (err) console.error(err); e() }));
    }
}