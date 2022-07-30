#!/bin/node
const { instance } = require("gmll");
const gmll = require("gmll");
const config = require("gmll/config");
const d = require("gmll/downloader");
const { dir, file } = require("gmll/objects/files");


const { fastLaunch } = require("msmc");
config.setRoot(".M C")
gmll.init().then(async () => {
  // gmll.downloader.runtime("jre-legacy");
 // const e = await fastLaunch("raw", console.log);
  //const token = gmll.wrapper.msmc2token(e);
  var int = new gmll.instance({ version: "1.19" })
  //int.setIcon("icon_32x32.png", "icon_16x16.png");

  //const instance = (await gmll.handler.importLink(", "launcherTest-1"))


  console.log(await int.wrap("https://www.hanro50.net.za/test", new dir(".wrap"), "MyAmazingPack"));
  //await instance.launch(token);
  try {
    // await inst.wrap("https://www.hanro50.net.za/test", new dir(".wrap"), "MyAmazingPack", config.getInstances().getFile("launchertest", "forge", "forge-1.16.4-35.1.37-installer.jar"))
  } catch (e) {
    console.trace(e)
  }

  //  int.launch(token);
})



