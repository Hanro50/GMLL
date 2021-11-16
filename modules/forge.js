import Fetch from "node-fetch";
import { join } from "path";
import { getConfig } from "./config.js"
import { mkdir } from "./internal/util.js";
import crypto from "crypto";
import { createWriteStream, existsSync, readFileSync } from "fs";
import { getJavaPath } from "./instance.js";
import { spawn } from "child_process";
const config = await getConfig();
const forgiacURL = "https://github.com/Hanro50/Forgiac/releases/download/1.7-SNAPSHOT/Forgiac-basic-1.7-SNAPSHOT.jar"
const forgiacSHA = "https://github.com/Hanro50/Forgiac/releases/download/1.7-SNAPSHOT/Forgiac-basic-1.7-SNAPSHOT.jar.sha1"

export async function build() {
    var libzFolder = join(config.files.libraries, "za", "net", "hanro50", "forgiac", "basic")
    mkdir(libzFolder);
    var libs = join(libzFolder, "forgiac.jar");
    if (existsSync(libs)) {
        var rURL2 = await Fetch(forgiacSHA);
        console.log(rURL2)
        if (rURL2.status == 200) {
            const txt = await rURL2.text();
            console.log(txt)

            const fileBuffer = readFileSync(libs);
            const hashSum = crypto.createHash('sha1');
            hashSum.update(fileBuffer);

            const hex = hashSum.digest('hex');
            if (hex == txt)
                return libs;
            else
                console.error(hex != txt);
        }
    }
    await new Promise(async e => {
        console.log("Downloading forgiac")
        const file = createWriteStream(libs)
        const res = await Fetch(forgiacURL);
        res.body.pipe(file, { end: "true" });
        file.on("close", e);

    });

    return libs;
}
/**
 * @param {String | String[] | null} file
 */
export async function install(file) {
    const javaPath = getJavaPath("java-runtime-alpha");
    const path = join(config.files.instances, ".forgiac");
    const logFile = join(path, "log.txt")
    var args = ["-jar", await build(), "--log", logFile, "--virtual", config.files.versions, config.files.libraries, "--mk_manifest", config.metaFiles.version.folder]
    if (file) {//--installer
        file = (file instanceof Array ? join(...file) : file);
        args.push("--installer", file);
    }

    mkdir(path);
    const s = spawn(javaPath, args, { "cwd": path })
    s.stdout.pipe(process.stdout);
    s.stderr.pipe(process.stderr);
    console.log(await new Promise(e => s.on('exit', e)));

}