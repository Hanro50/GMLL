#!/bin/node
import { wrapper, init, instance } from "gmll";
import { setRoot } from "gmll/config";
import { installForge } from "gmll/handler";
setRoot(".MC")
await init();

import { fastLaunch } from "msmc";
import { getLauncherVersion } from "gmll/config";

//await installForge();

//runtime("minecraft-java-exe")
const token = wrapper.msmc2token(await fastLaunch("raw", console.log));
console.log(getLauncherVersion())
const i = new instance({ version: "1.19" });
i.setIcon("icon_32x32.png", "icon_16x16.png");
i.launch(token);


