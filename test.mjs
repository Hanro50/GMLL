import {  instance } from "./dist/modules/instance.js";
import { getSelf } from "./dist/modules/internal/get.js";
import { initialize } from "./dist/modules/config.js";

await initialize();
console.log(getSelf())

getSelf();
new instance({version:"1.12.2"}).launch({name:"Hanro50"})
