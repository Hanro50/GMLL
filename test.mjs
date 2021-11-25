import {  client } from "./dist/modules/objects/client.js";
import { getSelf } from "./dist/modules/internal/get.js";
import { initialize } from "./dist/modules/config.js";

await initialize();
console.log(getSelf())

getSelf();
new client({version:"1.18-rc1"}).launch({name:"Hanro50"})
