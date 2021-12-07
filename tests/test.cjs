
const gmll = require("gmll");

const config = require("gmll/config");

const { fastLaunch,setFetch } = require("msmc");
fastLaunch("raw",console.log).then(e=>{
    const token = gmll.msmcWrapper(e);
    setFetch()
    gmll.init().then(e=>{new gmll.instance({version:"1.18"}).launch(token)})

})



