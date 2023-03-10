/**Accessed by get.js, imports allowed from other GMLL modules */
import { join } from "path";
import fetch from "node-fetch";
import { existsSync, mkdirSync, unlinkSync, symlinkSync, readFileSync, createWriteStream, statSync, writeFileSync, rmSync, readdirSync, copyFileSync, lstatSync, renameSync, access, constants, } from 'fs';
import { createHash } from "crypto";
import { platform, tmpdir, type } from "os";
import { execSync, spawn } from "child_process";
import type { downloadableFile } from "../../types";
export interface wrappedObj { save: () => void, getFile: () => file }

/**
 * @param dest Path to create the link in
 * @param path Path to the file to link to
 */
function mklink(dest: string, path: string) {
    try {
        if (existsSync(path)) unlinkSync(path)

        symlinkSync(dest, path, "junction");
    } catch (e) {
        console.error(e, existsSync(path), path);
        console.error("Could not create syslink between d:" + dest + "=>p:" + path)
        process.exit()
    }
}

function mkdir(path: string) { if (!existsSync(path)) mkdirSync(path, { recursive: true, }); };
const isWin = platform() == "win32";

export function stringify(json: object) {
    //@ts-ignore
    return JSON.stringify(json, "\n", "\t");
}
export function packAsync(pathToDirOrFile: string, pathToArchive: string, zipDir?: dir) {
    let com = ["a", "-r", pathToArchive, pathToDirOrFile]
    return new Promise<void>(e => {
        const s = spawn(get7zip(zipDir).sysPath(), com, { "env": process.env });
        s.on("exit", e);
    });

};
export class dir {
    path: string[];
    constructor(...path: string[]) {
        this.path = [];
        if (!isWin && path[0].startsWith("/")) { this.path.push("/"); }
        path.forEach(e => {
            if (isWin) e = e.replace(/\\/g, '/');
            this.path.push(...e.split("/"));
        })
        this.path = this.path.filter((el) => { return el.length > 0 });
    }

    /**Returns a hash of all the sub files in a folder */
    getHash(algorithm = "sha1") {
        let s = "";
        this.ls().forEach(e => s += e.getHash(algorithm))
        return createHash(algorithm).update(s).digest("hex");
    }
    /**Checks if a directory or file is in a relative or absolute state */
    isRelative() {
        if (this.path.length < 1) return true
        if (isWin) return !this.path[0].includes(":");
        return !this.path[0].startsWith("/");
    }
    /**Return the system path of a directory */
    sysPath() {
        if (this.isRelative()) return join(process.cwd(), ...this.path);
        return join(...this.path);
    }
    /**Double checks if the directory exists */
    mkdir() {
        mkdir(join(...this.path));
        return this;
    }
    /**Creates a system link to this file and puts the link at the destination file that was provided as input (similar to {@link linkFrom})*/
    linkTo(dest: string | string[] | this) {
        if (this instanceof file && platform() == "win32") console.warn("[GMLL]: Symlinks in Windows need administrator privileges!\nThings are about to go wrong!")
        if (dest instanceof file)
            dest = [...dest.path, dest.name];
        if (dest instanceof dir)
            dest = dest.path;
        if (dest instanceof Array)
            dest = join(...dest);
        mklink(dest, this.sysPath());
    }
    /**Creates a system link to a set file or directory using this file or folder as the the placeholder for the link (similar to {@link linkTo})*/
    linkFrom(path: string | string[] | this) {
        if (this instanceof file && platform() == "win32") console.warn("[GMLL]: Symlinks in Windows need administrator privileges!\nThings are about to go wrong!")
        if (path instanceof file)
            path = [...path.path, path.name];
        if (path instanceof dir)
            path = path.path;
        if (path instanceof Array)
            path = join(...path);
        mklink(this.sysPath(), path);
    }
    /**Returns the system temp directory */
    static tmpdir() { return new dir(tmpdir()); }
    /**Returns the amount of files in a directory*/
    getSize() { return readdirSync(this.sysPath()).length; }
    /**Checks if a directory is a symbolic link */
    islink() { return lstatSync(this.sysPath()).isSymbolicLink(); }
    /**Does the same as the {@link sysPath} function */
    toString() { return this.sysPath(); }
    /**Gets a new directory relative to this directory */
    getDir(..._file: string[]) { return new dir(...this.path, ..._file); }
    /**Gets a new file relative to this directory */
    getFile(..._file: string[]) { return new file(...this.path, ..._file); }
    /**Removes this file or directory */
    rm() {
        rmSync(this.sysPath(), { recursive: true, force: true });
        return this;
    }
    /**Copies this file or directory to a set location*/
    copyTo(dir: this) { copyFileSync(this.sysPath(), dir.sysPath()); }
    /**Moves this file or directory to a set location*/
    moveTo(file: this) { renameSync(this.sysPath(), file.sysPath()); return file; }
    /**Checks if this file exists */
    exists() { return existsSync(this.sysPath()); }
    /**Returns a java path off this directory or file */
    javaPath() { return this.path.join("/"); }
    /**Gets the name of this directory*/
    getName() { return this.path[this.path.length - 1] }
    /**Lists a set directory's contents*/
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
    /**Checks if the size value given matches with this object. (@see {@link getSize})*/
    size(expected: number) {
        if (!this.exists()) return false
        return this.getSize() == expected;
    }
    /**Checks if an expected hash matches with this object. (@see {@link getHash})*/
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
    /**Returns true if the file is in missmatch.*/
    chkSelf(chk?: { sha1?: string | string[], size?: number }) {
        if (!chk || !this.exists()) return true
        if (chk.sha1 && !this.sha1(chk.sha1)) return true
        if (chk.size && !this.size(chk.size)) return true

        return false;
    }
}
export class file extends dir {
    name: string;
    constructor(...path: string[]) {
        super(...path);
        this.name = this.path.pop();
    }
    /**Gets the directory of a set file */
    dir(): dir { return new dir(...this.path); }
    /**Reads a file and returns the raw array buffer */
    readRaw() { return readFileSync(this.sysPath()); }
    /**Reads a file and returns it as a string */
    read(): string { return this.readRaw().toString(); }
    /**Returns a base64 representation of the file */
    toBase64() { return readFileSync(this.sysPath(), 'base64url'); }
    /**@override Gets the name of this file*/
    getName() { return this.name; }
    /**@override Return the system path of a file*/
    sysPath() { return join(super.sysPath(), this.name); }
    /**@override */
    javaPath() { return [...this.path, this.name].join("/"); }
    /**@override gets the hash of this file*/
    getHash(algorithm: string = "sha1") { return createHash(algorithm).update(readFileSync(this.sysPath())).digest("hex"); }
    /**@override gets the size of this file*/
    getSize() { return statSync(this.sysPath()).size; }
    /**Reads a set file and returns a json representation of that object*/
    toJSON<T>() {
        if (this.exists())
            return JSON.parse(readFileSync(this.sysPath()).toString()) as T;
        console.trace();
        throw "No file to read!"
    }
    /**
     * Downloads a set file using fetch internally
     * @param url The url of the file you want to download
     * @param chk The file check
     * @returns this object to allow for chaining
     */
    async download(url: string, chk?: { sha1?: string | string[], size?: number }, signal?: AbortSignal) {
        if (this.chkSelf(chk))
            await new Promise((resolve, reject) => {
                const file = createWriteStream(this.sysPath());
                fetch(url, { signal }).then(res => {
                    if (!res.ok) reject(res.status);
                    res.body.pipe(file, { end: true });
                    file.on("close", resolve);
                }).catch(reject)
            });
        return this;
    }
    /**Sets the execution bit on a set file, used on Linux and Mac systems */
    chmod() { if (type() != "Windows_NT" && this.exists()) execSync(`chmod +x "${this.sysPath()}"`) }
    /**Writes data to file. Automatically converts JSON objects to parsable strings before saving them*/
    write(data: string | ArrayBuffer | object) {
        if (typeof data == "object") data = stringify(data);
        writeFileSync(this.sysPath(), data);
    }
    /**Loads a json object from the file system and adds some shortcut functions to make it easier to save. */
    load<T>(def: T, serializer: (raw: T) => T = (raw) => raw) {
        let obj: T = this.exists() ? serializer(this.toJSON<T>()) : serializer(def)
        return this.wrap(obj)
    }
    /**Turns an object into a wrappedObj. Essentially this just adds functions to make it easier to save. */
    wrap<T>(obj: T) {
        const result = obj as T & wrappedObj;
        result.getFile = () => this;
        result.save = () => this.write(result);
        return result
    }
    toDownloadable(url: string, key?: string, chk?: { sha1?: string | string[], size?: number }, opt?: { executable?: boolean | string, unzip?: { file: dir, exclude?: string[] } }) {
        this.mkdir();
        let d: downloadableFile = { key: key || [...this.path, this.name].join("/"), name: this.name, path: this.path, url: url, chk: {} }
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
    /**
     * 0 Full redownload
     * 1 unzip only 
     * 2 fine
     */
    static check(json: Partial<downloadableFile>) {
        let f = new this(...json.path, json.name);
        let i = 2;
        if (json.dynamic && f.exists()) return 2;
        if (json.executable || json.unzip) i = 1;
        if (!json.chk || !json.path || !json.name) return 0;
        return f.chkSelf(json.chk) ? 0 : i;
    }
    async expand(json: Partial<downloadableFile>, zipDir: dir) {
        if (json.unzip) {
            await this.unzip(new dir(...json.unzip.file), json.unzip.exclude, zipDir);
        }
        if (json.executable) {
            if (typeof json.executable == "boolean") this.chmod();
            else new file(json.executable).chmod();
        }
    }

    static async process(json: downloadableFile, zipDir: dir) {
        let f = new this(...json.path, json.name);
        if (json.dynamic && f.exists()) {
            return;
        }
        await f.download(json.url, json.chk);
        await f.expand(json, zipDir);

    }
    /**Similar to {@link extract}, but uses a blacklist approach */
    unzip(path: dir, exclude?: string[], zipDir?: dir) {
        var com = ['x', this.sysPath(), '-y', '-o' + path.sysPath()]
        if (exclude) {
            exclude.forEach(e => {
                var f = String(e);
                if (f.endsWith("/")) f += "*"
                com.push("-xr!" + f);
            })
        }
        return new Promise<void>(e => {
            const s = spawn(get7zip(zipDir).sysPath(), com, { "cwd": join(this.getDir().sysPath()), "env": process.env });
            s.on("exit", e);
        });
    }
    /**Similar to {@link unzip}, but uses a whitelist approach */
    extract(path: dir, files: string[], zipDir?: dir) {
        var com = ['x', this.sysPath(), '-y', '-o' + path.sysPath()]

        files.forEach(e => {
            var f = String(e);
            if (f.endsWith("/")) f += "*"
            com.push(f);
        })
        com.push("-r");
        return new Promise<void>(e => {
            const s = spawn(get7zip(zipDir).sysPath(), com, { "cwd": join(this.getDir().sysPath()), "env": process.env });
            s.on("exit", e);
        });

    }
    //**Checks if a file is executable */
    isExecutable(): Promise<boolean> {
        return new Promise((res) => access(this.sysPath(), constants.F_OK, (err) => res(err ? false : true)));
    }
}
let defDir = dir.tmpdir().getDir("gmll");

function get7zip(dir: dir = defDir) {
    const loc = dir.getDir("7z");
    const d = loc.getFile("index.json");
    if (!d.exists()) throw "Not initialized"
    const m = d.toJSON<{ _main: string, [key: string]: string }>()
    return loc.getFile(m._main);
}

/**The location serving 7zip binary*/
export function set7zipRepo(z7: string) {
    z7Repo = z7;
}
let z7Repo = "https://download.hanro50.net.za/7-zip";
export async function download7zip(dir: dir, os: "linux" | "windows" | "osx", arch: "arm" | "arm64" | "x32" | "x64") {
    defDir = dir;
    console.log("[GMLL]: Checking 7zip")
    const loc = dir.getDir("7z");
    loc.mkdir();
    let chk: { [key: string]: { size: number, sha1: string } } = {};
    const chkFile = loc.getFile("hash.json")
    if (chkFile.exists()) {
        try { chk = chkFile.toJSON(); } catch { }
    }
    const manifest = loc.getFile("index.json");
    if (!z7Repo.endsWith("/")) z7Repo += "/";
    const link = `${z7Repo}${os}/${arch}/`

    const f = await manifest.download(link + "index.json", chk["index"])
    chk["index"] = { size: f.getSize(), sha1: f.getHash() }
    const m = f.toJSON<{ _main: string, [key: string]: string }>()
    const _main = m._main;
    for (const key of Object.keys(m)) {
        console.log(key)
        if (key == "_main") continue;
        const obj = m[key]
        const f = await loc.getFile(key).download(link + obj, chk[key])
        chk[key] = { size: f.getSize(), sha1: f.getHash() }
        if (key == _main) f.chmod();
    }
    chkFile.write(chk);
}