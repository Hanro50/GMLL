#!/bin/node
import { wrapper, init, instance} from "gmll";
import { setRoot } from "gmll/config";
setRoot(".MC")
await init();

import {auth } from "msmc";
import { getLauncherVersion } from "gmll/config";
const aobj = new auth("select_account");
const i = new instance({version:"fabric-loader-0.14.5-1.19"});
i.setIcon("icon_32x32.png", "icon_16x16.png");

//await installForge();

//runtime("minecraft-java-exe")
const token = (await (await aobj.launch("raw")).getMinecraft()).gmll();
console.log(getLauncherVersion())



i.launch(token);

