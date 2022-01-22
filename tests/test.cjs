#!/bin/node
const gmll = require("gmll");
const config = require("gmll/config");
const d = require("gmll/downloader");
const { dir } = require("gmll/objects/files");

const { fastLaunch } = require("msmc");
config.setRoot(".MC")
gmll.init().then(async () => {
   // const e = await fastLaunch("raw", console.log);
    //const token = gmll.wrapper.msmc2token(e);
    var int = new gmll.instance({ version: "1.18.1" })
    int.setIcon("icon_32x32.png","icon_16x16.png")
    console.log (await int.wrap("https://www.hanro50.net.za/test",new dir(".wrap")))
    
  //  int.launch(token);
})



const {instance} = require("gmll/objects/instance");
