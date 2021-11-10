

import { randomUUID } from "crypto";
import {getConfig} from "./modules/config.js";
import { install } from "./modules/forge.js";
import {} from "./modules/handler.js"
await install();
console.log(await getConfig())

import  profile  from "./modules/instance.js";
const p = new profile({version:"1.17.1-forge-37.0.103"});
p.launch({name:"test",uuid:randomUUID(),demo:true,"type":"legacy"})




