import { AddressInfo } from "net"
import http, { Server } from "http"
import { assetIndex } from "gmll/types";
import fetch from "node-fetch";
import { assetURL } from "../downloader";

export function proximate(index: assetIndex): Promise<{ server: Server, port: number }> {
    const resourceURL = "http://www.minecraft.net/resources/"
    const skinURL = "/skin/"
    const skin2URL = "/MinecraftSkins/"
    const capeURL = "/MinecraftCloaks/"
    async function getSkin(username: string) {
        const r = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
        if (r.status == 200) {
            const uuid = (await r.text())
            console.log(uuid, r)
            const r2 = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${JSON.parse(uuid).id}`);
            if (r2.status == 200) {
                try {
                    const json = await r2.json();
                    return JSON.parse(Buffer.from(json.properties[0].value, "base64").toString()).textures as { SKIN: { url: string }, CAPE?: { url: string } };
                } catch (e) {
                    console.error("[GMLL]: Failed to parse skin!")
                }
            }
        }
    }
    const D = Date.now()
    return new Promise(async (res) => {
        const server = http.createServer().listen(() => res({ server, port: (server.address() as AddressInfo).port }));
        server.on('request', async (req, res) => {
            async function getCape(url: string, clothing: "CAPE" | "SKIN") {
                let username = req.url.substring(req.url.indexOf(url) + url.length, req.url.length - 4);
                const L = (await getSkin(username))?.[clothing]?.url;
                if (L) return res.writeHead(302, { "Location": L }).end();
                else return res.writeHead(404).end();
            }
            console.log(req.headers, req.url)
            try {
                if (req.url.startsWith(resourceURL)) {
                    const uri = req.url.substring(resourceURL.length);
                    if (uri.length == 0) {
                        let resources = "";
                        Object.entries(index.objects).forEach(e => resources += `${e[0]},${e[1].size},${D}\n`);
                        res.writeHead(200, { "Content-Type": "text/plain" });
                        res.write(resources);
                        return res.end();
                    } else {
                        const obj = index.objects[uri]
                        if (obj) return res.writeHead(302, { "Location": `${assetURL + obj.hash.substring(0, 2) + "/" + obj.hash}` }).end();
                        else return res.writeHead(404).end();
                    }
                }
                else if (req.url.includes(capeURL)) return getCape(capeURL, "CAPE");
                else if (req.url.includes(skin2URL)) return getCape(skin2URL, "SKIN");
                else if (req.url.includes(skinURL)) return getCape(skinURL, "SKIN");
                fetch(req.url).then(f_res => {
                    f_res.body.pipe(res, { end: true });
                    res.on("close", () => res.end());
                }).catch(() => res.writeHead(500).end())
            } catch (e) {
                console.error(e);
                return res.writeHead(500).end();
            }
        });
    })
}