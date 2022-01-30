#!/bin/node
import { wrapper, init, instance } from "gmll";
import { setRoot } from "gmll/config";
import { installForge } from "gmll/handler";


import { fastLaunch } from "msmc";
import { runtime } from "gmll/downloader";
import { getLauncherVersion } from "gmll/config";

setRoot(".MC")
await init();
//installForge();
//runtime("minecraft-java-exe")
//const token = wrapper.msmc2token(await fastLaunch("raw", console.log));
console.log(getLauncherVersion())
//const i = new instance({ version: "1.7.10" });
//i.setIcon("icon_32x32.png", "icon_16x16.png");
//i.save();
//i.launch(token);


