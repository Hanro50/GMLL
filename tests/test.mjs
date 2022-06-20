#!/bin/node
import { wrapper, init, instance} from "gmll";
import { setRoot } from "gmll/config";
setRoot(".MC")
await init();

import { fastLaunch } from "msmc";
import { getLauncherVersion } from "gmll/config";

const i = new instance({version:"fabric-loader-0.14.5-1.19"});
i.setIcon("icon_32x32.png", "icon_16x16.png");

//await installForge();

//runtime("minecraft-java-exe")
const token = wrapper.msmc2token(await fastLaunch("raw", console.log));
console.log(getLauncherVersion())



i.launch(token);

