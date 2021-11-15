

import { randomUUID } from "crypto";
import {getConfig} from "./modules/config.js";
import { install } from "./modules/forge.js";
import {} from "./modules/handler.js"
await install();
console.log(await getConfig())

import  profile  from "./modules/instance.js";
const p = new profile({version:"1.12.2-forge-14.23.5.2855"});
p.launch({name:"test",uuid:randomUUID(),demo:true,"type":"legacy"})




