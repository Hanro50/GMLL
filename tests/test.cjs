#!/bin/node
const gmll = require("gmll");
const config = require("gmll/config");
const d = require("gmll/downloader");
const { dir, file } = require("gmll/objects/files");
const { instance } = require("gmll/objects/instance");

const { fastLaunch } = require("msmc");
config.setRoot(".MC")
gmll.init().then(async () => {
  // gmll.downloader.runtime("jre-legacy");
  //const e = await fastLaunch("raw", console.log);
  //const token = gmll.wrapper.msmc2token(e);
  //var int = new gmll.instance({ version: "1.18.1" })
  //int.setIcon("icon_32x32.png", "icon_16x16.png");
  //console.log(await int.wrap("https://www.hanro50.net.za/test", new dir(".wrap"), "MyAmazingPack"));
  const instance = (await gmll.handler.importLink("https://www.hanro50.net.za/test", "launcherTest"))
 // await instance.launch(token);
try{
  await instance.wrap("https://www.hanro50.net.za/test", new dir(".wrap"), "MyAmazingPack", config.getInstances().getFile("launchertest", "forge", "forge-1.16.4-35.1.37-installer.jar"))
}catch(e){
  console.trace(e)
}

  //  int.launch(token);
})



