
import { randomUUID } from "crypto";
import {getConfig} from "./modules/config.js";
import {} from "./modules/handler.js"

console.log(await getConfig())

import  profile  from "./modules/instance.js";
const p = new profile({version:"1.17.1"});
p.launch({name:"test",uuid:randomUUID(),demo:true,"type":"legacy"})




