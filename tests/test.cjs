
const gmll = require("gmll");
const config = require("gmll/config");


const { fastLaunch } = require("msmc");
config.setRoot(".MC")
fastLaunch("raw", console.log).then(async e => {
   
    const token = gmll.wrapper.msmc2token(e);
    await gmll.init();
    new gmll.instance({ version: "1.17" }).launch(token);
})



