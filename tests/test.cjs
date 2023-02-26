#!/bin/node

const { readNBT ,readDat} = require("gmll/nbt");

const { instance } = require("gmll");
const gmll = require("gmll");
const config = require("gmll/config");
const d = require("gmll/downloader");
const { dir, file } = require("gmll/objects/files");

const { auth } = require("msmc");
config.setRoot(".MC3")
gmll.init().then(async () => {
  // gmll.downloader.runtime("jre-legacy");
const token = (await (await new auth().launch("raw")).getMinecraft()).gmll()
 // const token = gmll.wrapper.msmc2token(e);
  var int = new gmll.instance({ version: "b1.7"})

 // console.log(JSON.stringify(await int.getWorlds()));
  // (await int.getWorlds()).forEach(e=>{
   // console.log(e.players);

 // })
 // console.log(JSON.stringify(await readDat((await int.getMetaPaths()).saves.getFile("New World", "level.dat"))))
  //console.log((await int.getMetaPaths()).saves.getFile("New World", "level.dat").sysPath())

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