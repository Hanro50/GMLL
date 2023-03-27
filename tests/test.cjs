#!/bin/node
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */

const gmll = require("gmll");
//Import the auth class
const { Auth } = require("msmc");

gmll.init().then(async () => {
  //Create a new auth manager
  const authManager = new Auth("select_account");
  //Launch using the 'raw' gui framework (can be 'electron' or 'nwjs')
  const xboxManager = await authManager.launch("raw")
  //Generate the minecraft login token
  const token = await xboxManager.getMinecraft()

  var int = new gmll.Instance()
  //Launch with the gmll token
  int.launch(token.gmll());

})



const { cpus } = require("os")
console.log(cpus())