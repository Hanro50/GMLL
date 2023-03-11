#!/bin/node

const gmll = require("gmll");
//Import the auth class
const { auth } = require("msmc");

gmll.init().then(async () => {
  //Create a new auth manager
  const authManager = new auth("select_account");
  //Launch using the 'raw' gui framework (can be 'electron' or 'nwjs')
  const xboxManager = await authManager.launch("raw")
  //Generate the minecraft login token
  const token = await xboxManager.getMinecraft()

  var int = new gmll.instance()
  //Launch with the gmll token
  int.launch(token.gmll());

  try {
  } catch (e) {
    console.trace(e)
  }

})



const { cpus } = require("os")
console.log(cpus())