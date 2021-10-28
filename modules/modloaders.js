const FETCH = require("node-fetch");
const config = require("./config");
const fs = require('fs');

const p = require("path");
async function updateFabric() {
    const patchFile = p.join(config.launcherFiles.patch, "fabric.json");
    const hashFile = p.join(config.launcherFiles.patch, "fabric.hash");
    const rg = await FETCH("https://meta.fabricmc.net/v2/versions/game/");
    const rg2 = await FETCH("https://meta.fabricmc.net/v2/versions/loader/");
    if (rg2.status != 200) return;
    if (rg.status != 200) return;
    /**@type {Array} */
    const jsgame = await rg.json();
    const jsloader = await rg2.json();
    const result = [];
    jsgame.forEach(game=>{
        const version = game.version;
        jsloader.forEach(l => {
            result.push(
                {
                    id: "fabric-loader-"+  l.version +"-" + version,
                    base: version,
                    stable: l.stable,
                    type: "fabric",
                    url: "https://meta.fabricmc.net/v2/versions/loader/" + version + "/" + l.version + "/profile/json"
                })
        })
    })
    fs.writeFileSync(patchFile, JSON.stringify(result));
}

if (config.config.fabric == "true")
    updateFabric();