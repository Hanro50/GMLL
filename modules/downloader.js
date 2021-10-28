//Handles mass file downloads
const cluster = require('cluster');
const { cpus } = require('os');
const process = require('process');
const fs = require('fs');
const path = require('path');
const Fetch = require('node-fetch');

const processCMD = "download.progress";
const failCMD = "download.fail";
/**
 * @param {{objects:{[key: string]:{hash:string,size:number}}}} file 
 */
if (cluster.isWorker) {
    const keys = JSON.parse(process.env.data)
    keys.forEach(o => {
        var retry = 0;
        async function load() {
            if (fs.existsSync(o.location)) {
                var stats = fs.statSync(o.location)
                if (o.sha1) {

                }
                if (stats.size == o.size) {
                    process.send({ cmd: processCMD, key: o.key });
                    return;
                }
                if (stats.size > 0)
                    console.log("[GMLL]: " + stats.size + " vs " + o.size + " : " + o.key)
            }
            const download =
                new Promise(async e => {
                    const file = fs.createWriteStream(o.location)
                    const res = await Fetch(o.url);
                    res.body.pipe(file, { end: "true" });
                    file.on("close", e)
                });
            download.then(() => process.send({ cmd: processCMD, key: o.key }));
            download.catch(e => {
                if (retry > 3) {
                    console.log(e)
                    process.send({ cmd: processCMD, key: o.key });
                    process.send({ cmd: failCMD, type: "fail", key: o.key, err: e });
                    return;
                }
                console.log(e)
                retry++;
                process.send({ cmd: failCMD, type: "retry", key: o.key, err: e });
                load();
            });
        }
        load().catch(e => {
            console.log(e)
            console.log("[GMLL]: procedural failure : " + o.key);
            process.send({ cmd: failCMD, type: "system", key: o.key, err: e });
            process.send({ cmd: processCMD, key: o.key });
            return;
        });
    });
} else {
    const os = require("os");
    const config = require("./config");
    const defEvents = config.eventManager;
    const files = config.files;
    const arch = os.arch();
    const OS = os.platform();
    const AdmZip = require("adm-zip")
    if (OS == "win32") OS = "windows";
    if (OS == "darwin") OS = "osx"
    cluster.setupMaster({
        exec: __filename
    });
    /**
 * 
 * @param {Array<{size: Number, location: string, url: string, key:string,sha1?:string}>} data 
 * @param {EventEmitter} events 
 * @param {(key:string)=>Number} onDone 
 * @param {(Number)=>Promise<any>} onTimeOut 
 * @param {Number} iterations 
 * @param {Number} totalItems 
 * @returns 
 */
    module.exports.downloader = (data, events, onDone, onTimeOut, iterations, totalItems) => {
        const numCPUs = cpus().length;
        var done = 0;
        var arr = [];
        events.emit("download.setup", numCPUs);
        data.sort((a, b) => b.size - a.size);
        for (let i3 = 0; i3 < numCPUs; i3++) {
            var iCpu = [];
            for (let i = i3; i < data.length; i += numCPUs) iCpu.push(data[i]);
            arr.push(iCpu);
        }
        return new Promise(res => {
            /**@type {Array<cluster.Worker>} */
            const workers = [];
            const fire = () => workers.forEach(w => w.process.kill());
            const to = setTimeout(() => {
                events.emit('download.restart');
                fire();
                iterations++;
                res(onTimeOut(iterations));
            }, 15000 * iterations);
            events.emit('download.start');
            for (let i = 0; i < arr.length; i++) {
                const w = cluster.fork({ "data": JSON.stringify(arr[i]) });
                workers.push(w);
                w.on('message', (msg) => {
                    to.refresh();
                    if (!msg.cmd) return;
                    if (msg.cmd === processCMD) {
                        done++;
                        const left = onDone(msg.key);
                        events.emit('download.progress', msg.key, done, totalItems, left);
                        if (left < 1) {
                            clearTimeout(to);
                            events.emit('download.done');
                            fire();
                            res();
                        }
                    }
                    else if (msg.cmd === failCMD) events.emit('download.fail', msg.key, msg.type, msg.err);
                });
            }
        });
    }
    module.exports.assets = async (file, events = defEvents, r = 1) => {
        const basepath = files.assets;
        const object = file.objects;
        const objectPath = path.join(basepath, "objects");
        if (!fs.existsSync(basepath)) { fs.mkdirSync(basepath); }
        if (!fs.existsSync(objectPath)) { fs.mkdirSync(objectPath); }
        Object.values(object).forEach(o => {
            const folder = path.join(objectPath, o.hash.substring(0, 2));
            if (!fs.existsSync(folder)) { fs.mkdirSync(folder); }
        })

        const keys = Object.keys(object);
        const arr = [];

        for (let i = 0; i < keys.length; i++) {
            const o = object[keys[i]]
            const resource = "http://resources.download.minecraft.net/" + o.hash.substring(0, 2) + "/" + o.hash;
            const location = path.join(path.join(objectPath, o.hash.substring(0, 2)), o.hash);
            arr.push({ size: o.size, location: location, url: resource, key: keys[i] });
        }

        const onDone = (key) => { delete file.objects[key]; return Object.keys(file.objects).length; };
        const onTimeOut = (iter) => this.assets(file, events, iter);
        return await this.downloader(arr, events, onDone, onTimeOut, r, keys.length);
    }
    /**
     * @param  {{libraries:Array<GMLL.libFiles>,id:string,assets:string}} versionJSON 
     * @param {*} events 
     * @param {*} r 
     */
    module.exports.libs = async (versionJSON, events = defEvents, r = 1) => {
        const libArray = versionJSON.libraries
        /**@type {Array<GMLL.artifact>} */
        var LibFiles = {};
        console.log("Checking rules");
        var toUnzip = [];
        for (var key = 0; key < libArray.length; key++) {
            rule: {
                const e = libArray[key]
                if (e.rules) {
                    for (var i = 0; i < e.rules.length; i++) {
                        if (e.rules[i].action == "disallow" && (!e.rules[i].os || e.rules[i].os == OS)) {
                            console.log(e.rules)
                            break  rule;
                        }
                        else if (e.rules[i].action == "allow" && e.rules[i].os && e.rules[i].os != OS) {
                            console.log(e.rules)
                            break  rule;
                        }
                    }
                }
                if (e.downloads) {

                    if (e.downloads.classifiers && e.natives && e.natives[OS] && e.downloads.classifiers[e.natives[OS]]) {
                        const obj = e.downloads.classifiers[e.natives[OS]];
                        LibFiles[obj.path] = obj;
                            toUnzip.push(obj);
                    }
                    LibFiles[e.downloads.artifact.path] = (e.downloads.artifact);
                } else if (e.url) {
                    //Maven repo
                    const namespec = e.name.split(":")
                    const path = namespec[0].replace(/\./g, "/") + "/" + namespec[1] + "/" + namespec[2] + "/" + namespec[1] + "-" + namespec[2] + ".jar";
                    const r = await fetch(path + ".sha1")
                    /**@type {GMLL.artifact} */
                    var artifact = { path: path, sha1: await r.text(), url: e.url + path }
                    LibFiles[path] = (artifact);
                } else {
                    console.log(e)
                }

            }
        }

        console.log("Checking rules");
        function load() {
            const arr = []
            Object.values(LibFiles).forEach(e => {
                var file = files.libraries;
                const filz = String(e.path).split("/");
                //console.log(path.join(file, ...filz));
                arr.push({ size: e.size, location: path.join(file, ...filz), url: e.url, key: e.path, sha: e.sha1 })
                for (var fff = 0; fff < filz.length - 1; fff++) {
                    file = path.join(file, filz[fff]);
                    //  console.log(file);
                    if (!fs.existsSync(file)) fs.mkdirSync(file);
                }
            })
            const onDone = (key) => { delete LibFiles[key]; return Object.keys(LibFiles).length; };
            return module.exports.downloader(arr, events, onDone, load, 2, Object.keys(LibFiles).length);
        }
        load().then(() => {
            toUnzip.forEach(e => {
              
                const filePat = e.path;
                const filz = filePat.split("/");
                const file = path.join(files.natives, versionJSON.assets || versionJSON.id);
                console.log(path.join(files.libraries, ...filz))
                var zip = new AdmZip(path.join(files.libraries, ...filz));

                console.log(file)
                if (!fs.existsSync(file)) fs.mkdirSync(file);
                zip.extractAllTo(file);
            })
        });
    }



}
