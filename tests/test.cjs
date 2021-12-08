
const gmll = require("gmll");
const config = require("gmll/config");


const { fastLaunch } = require("msmc");
fastLaunch("raw", console.log).then(async e => {
    await config.resetRoot(".tests")
    const token = gmll.wrapper.msmc2token(e);
    await gmll.init();
    new gmll.instance({ version: "1.18" }).launch(token);
})



