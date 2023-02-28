import { AddressInfo } from "net"
import http, { Server } from "http"
import { assetIndex } from "gmll/types";
import fetch from "node-fetch";
import { assetURL } from "../downloader";

export function proximate(code: { index: assetIndex, port?: number, skinServer?: string }): Promise<{ server: Server, port: number }> {
    const index = code.index;
    const port = code.port || 0;
    const skinServer = code.skinServer;
    const resourceURL = "http://www.minecraft.net/resources/"
    const skinURL = "/skin/"
    const skin2URL = "/MinecraftSkins/"
    const capeURL = "/cloak/"
    const cape2URL = "/MinecraftCloaks/"
    const authUrl = "http://www.minecraft.net/game/"
    const D = Date.now()
    const server = http.createServer()
    server.on('request', async (req, res) => {
        async function getCape(url: string, clothing: "CAPE" | "SKIN") {
            let username = req.url.substring(req.url.indexOf(url) + url.length, req.url.length - 4);
            try {
                const uuidResp = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
                if (uuidResp.status == 200) {
                    const uuid = (await uuidResp.json()).id;
                    const playerDataResp = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`);
                    if (playerDataResp.status == 200) {
                        const playerData = await playerDataResp.json();
                        console.log(`[GMLL:Proxy]: Getting ${clothing.toLocaleLowerCase()} for ${username} [${uuid}]`);
                        const textures = JSON.parse(Buffer.from(playerData.properties[0].value, "base64").toString()).textures as { SKIN: { url: string }, CAPE?: { url: string } };
                        if (textures?.[clothing]?.url) return res.writeHead(301, { "Location": textures?.[clothing]?.url }).end();
                    }
                }
                if (skinServer) return res.writeHead(301, { "Location": `${skinServer}${skinServer.endsWith("/") ? "" : "/"}${clothing == "CAPE" ? cape2URL : skin2URL}${username}.png` }).end();
            } catch (e) {
                console.error(`[GMLL:Proxy]: Failed to parse ${clothing.toLocaleLowerCase()}!`);
            };
            console.warn(`[GMLL:Proxy]: Could not resolve ${clothing.toLocaleLowerCase()} for ${username}`);
            return res.writeHead(404).end();
        }
        console.log(`[GMLL:Proxy]: Got request [${req.url}]`)
        try {
            if (req.url.startsWith(resourceURL)) {
                const uri = req.url.substring(resourceURL.length);
                if (uri.length == 0) {
                    let resources = "";
                    Object.entries(index.objects).forEach(e => resources += `${e[0]},${e[1].size},${D}\n`);
                    res.writeHead(200, { "Content-Type": "text/plain" });
                    res.write(resources);
                    console.log(resources)
                    return res.end();
                
                } else {
                    const obj = index.objects[uri]
                    if (obj) return res.writeHead(302, { "Location": `${assetURL + obj.hash.substring(0, 2) + "/" + obj.hash}` }).end();
                    else return res.writeHead(404).end();
                }
            }
            else if (req.url.includes(capeURL)) return getCape(capeURL, "CAPE");
            else if (req.url.includes(cape2URL)) return getCape(cape2URL, "CAPE");
            else if (req.url.includes(skin2URL)) return getCape(skin2URL, "SKIN");
            else if (req.url.includes(skinURL)) return getCape(skinURL, "SKIN");
            else if (req.url.startsWith(authUrl)) return res.writeHead(301, { "Location": req.url.replace("www", "session") }).end();
            fetch(req.url).then(f_res => {
                f_res.body.pipe(res, { end: true });
                res.on("close", () => res.end());
            }).catch(() => res.writeHead(500).end())
        } catch (e) {
            console.error(e);
            return res.writeHead(500).end();
        }
    });
    return new Promise(async (res) => { server.listen(port, () => res({ server, port: (server.address() as AddressInfo).port })); });
}