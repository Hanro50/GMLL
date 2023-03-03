#!/bin/node

const { readNBT ,readDat} = require("gmll/nbt");

const { instance } = require("gmll");
const gmll = require("gmll");
const config = require("gmll/config");
const d = require("gmll/downloader");
const { dir, file } = require("gmll/objects/files");
const {installForge} = require("gmll/handler")
const { auth } = require("msmc");
config.setRoot(".MC3")
gmll.init().then(async () => {
  // gmll.downloader.runtime("jre-legacy");
const token = (await (await new auth().launch("raw")).getMinecraft()).gmll()
 // const token = gmll.wrapper.msmc2token(e);
 
  var int = new gmll.instance({ version: "1.13.2",legacyProxy:{port:8080}})
  //await int.installForge();
  int.launch(token);
  // console.log(await int.getMetaPaths())
  //int.setIcon("icon_32x32.png", "icon_16x16.png");

  //const instance = (await gmll.handler.importLink(", "launcherTest-1"))


  //console.log(await int.wrap("https://www.hanro50.net.za/test", new dir(".wrap"), "MyAmazingPack"));
  //await instance.launch(token);
  try {
    // await inst.wrap("https://www.hanro50.net.za/test", new dir(".wrap"), "MyAmazingPack", config.getInstances().getFile("launchertest", "forge", "forge-1.16.4-35.1.37-installer.jar"))
  } catch (e) {
    console.trace(e)
  }

  //  int.launch(token);
})



const {cpus} = require("os")
console.log(cpus())