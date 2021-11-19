import { mkdir, lawyer, getOS } from "./internal/util.js";
import { join } from "path";
import { emit } from "./config.js";
import { processCMD, failCMD } from "./internal/get.js"
//Handles mass file downloads
import { fork } from 'cluster';
import { cpus } from 'os';
import { join } from 'path';

/**
 * The root download function
 * @param {Array<GMLL.get.downloadable>} obj 
 */
export function download(obj) {
    emit("download.started");
    obj.sort((a, b) => { return (a.size || 0) - (b.size || 0) });
    var temp = {};
    var it = 1;
    obj.forEach((e, k) => {
        e.key = join(e.path, e.name);
        mkdir(e.path)
        if (e.unzip) mkdir(e.unzip.path);
        temp[e.key] = e;
    })

    function resolve() {
        return new Promise(res => {
            const numCPUs = cpus().length;
            emit("download.setup", numCPUs);
            var done = 0;
            var arr = [];
            const data = Object.values(temp);
            const workers = [];
            const fire = () => workers.forEach(w => w.process.kill());
            for (let i3 = 0; i3 < numCPUs; i3++) {
                var iCpu = [];
                for (let i = i3; i < data.length; i += numCPUs) iCpu.push(data[i]);
                arr.push(iCpu);
            }

            const to = setTimeout(async () => {
                emit('download.restart');
                fire();
                it++;
                res(await resolve());
            }, 15000 * it);

            for (let i = 0; i < arr.length; i++) {
                const w = fork({ "data": JSON.stringify(arr[i]) });
                workers.push(w);
                w.on('message', (msg) => {
                    to.refresh();
                    if (!msg.cmd) return;
                    if (msg.cmd === processCMD) {
                        done++;
                        delete temp[msg.key]

                        emit('download.progress', msg.key, done, totalItems, Object.values(temp).length);
                        if (left < 1) {
                            clearTimeout(to);
                            emit('download.done');
                            fire();
                            res();
                        }
                    }
                    else if (msg.cmd === failCMD) emit(msg.cmd, msg.key, msg.type, msg.err);
                });
            }
        });
    }
    return resolve();
}

export function runtime(runtime) {

}

export function asset(index) {

}

export function libraries(version) {

}

export function manifests() {

}