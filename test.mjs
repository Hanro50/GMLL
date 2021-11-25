import { manifests } from "./dist/modules/downloader.js";
import { start } from "./dist/modules/init.js";
import { installForge, instance } from "./dist/modules/instance.js";
import { getSelf } from "./dist/modules/internal/get.js";
import { getManifests } from "./dist/modules/versions.js";

await manifests();
console.log(getSelf())

getSelf();
new instance({version:"1.12.2"}).launch({name:"Hanro50"})
