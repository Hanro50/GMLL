import { AddressInfo } from "net"
import http, { Server } from "http"
import { assetIndex } from "gmll/types";
import fetch from "node-fetch";
import { assetURL } from "../downloader";
export interface meta {
    name: string;
    path: string;
    startup?: boolean;
    restart?: boolean;
    pwd?: string;
    runner?: string;
}
export interface script {
    meta: meta,
    data: string,

}
export interface proxy {
    port: number;
    host: string;
    prxy: string;
    hide: boolean;
}
export interface proxyServerConfig {
    http?: {
        port: Number;
    }
    https?: {
        port: Number;
        key: string;
        csr: string;
        ca: string[];
    }
}

export function proximate(index: assetIndex): Promise<{ server: Server, port: number }> {
    const resourceURL = "http://www.minecraft.net/resources/"
    const amazonURL = "http://s3.amazonaws.com/MinecraftResources/"
    const skinURL = "http://www.minecraft.net/skin/"
    const skin2URL = "http://skins.minecraft.net/MinecraftSkins/"
    const skin3URL = "http://s3.amazonaws.com/MinecraftSkins/"

    const oneSixFlag = "http://assets.minecraft.net/1_6_has_been_released.flag"
    const capeURL = "http://skins.minecraft.net/MinecraftCloaks/"
    const cape2URL = "http://s3.amazonaws.com/MinecraftCloaks/"

    async function getSkin(username: string) {
        const r = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
        if (r.ok) {

            const uuid = (await r.text())
            console.log(uuid, r)
            const r2 = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${JSON.parse(uuid).id}`);
            if (r2.ok) {
                try {
                    const json = await r2.json();
                    return JSON.parse(Buffer.from(json.properties[0].value, "base64").toString()).textures as { SKIN: { url: string }, CAPE?: { url: string } };
                    // return res.writeHead(302, { "Location": JSON.parse(Buffer.from(json.properties[0].value, "base64").toString()).textures}).end();
                } catch (e) {
                }
            }
        }
    }
    const D = Date.now()
    return new Promise(async (res) => {

        const server = http.createServer().listen(() => res({ server, port: (server.address() as AddressInfo).port }));
        server.on('request', async (req, res) => {
            async function getSkin2(url) {
                let username = req.url.substring(url.length, req.url.length - 4);
                const L = (await getSkin(username))?.SKIN?.url;
                if (L)
                    return res.writeHead(302, { "Location": L }).end();
                else return res.writeHead(404).end();
            }
            async function getCape(url) {
                let username = req.url.substring(url.length, req.url.length - 4);
                const L = (await getSkin(username))?.CAPE?.url;
                if (L)
                    return res.writeHead(302, { "Location": L }).end();
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
                        if (obj)
                            return res.writeHead(302, { "Location": `${assetURL + obj.hash.substring(0, 2) + "/" + obj.hash}` }).end();
                        else
                            return res.writeHead(404).end();
                    }
                }
                else if (req.url.startsWith(capeURL)) return getCape(capeURL)
                else if (req.url.startsWith(cape2URL)) return getCape(cape2URL)
                else if (req.url.startsWith(skin3URL)) return getSkin2(skin3URL)
                else if (req.url.startsWith(skin2URL)) return getSkin2(skin2URL)
                else if (req.url.startsWith(skinURL)) return getSkin2(skinURL)
                else if (req.url.startsWith(amazonURL) || req.url == oneSixFlag || req.url == "http://snoop.minecraft.net/server?version=1") return res.writeHead(200).end();

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