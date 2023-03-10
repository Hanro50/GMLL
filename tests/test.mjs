#!/bin/node


console.log(process.env)

import { wrapper, init, instance} from "gmll";
import { setRoot } from "gmll/config";
setRoot(".MC")
await init();
import {auth } from "msmc";
import { getLauncherVersion } from "gmll/config";
const token =(await (await new auth("select_account").launch("raw")).getMinecraft()).gmll() //(new auth("select_account"));
const i = new instance({version:"b1.7.3"});
i.setIcon("icon_32x32.png", "icon_16x16.png");
//await i.installForge()
//await installForge();

//runtime("minecraft-java-exe")
//const token = (await (await aobj.launch("raw")).getMinecraft()).gmll();
//console.log(getLauncherVersion())

//i.wrap("https://download.hanro50.net.za/b1.8","save");

i.launch(token);

