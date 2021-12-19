# <b>GMLL</b>
<a href="https://github.com/Hanro50/GMLL/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/msmc" alt="MIT license"/></a>
<a href="https://www.npmjs.com/package/gmll"><img src="https://img.shields.io/npm/v/gmll" alt="Version Number"/></a>
<a href="https://github.com/Hanro50/gmll/"><img src="https://img.shields.io/github/stars/hanro50/gmll" alt="Github Stars"/></a><br/>
A generic Minecraft Launcher Library 

# <b>Module type</b>
GMLL is a hybrid module. However as such, you should best avoid trying to use GMLL as both a ES6 and a CommonJS module in the same project. 

# <b>Support</b>
No support will be given to launchers that seek to grant access to Minecraft to individuals whom do not posses a valid Minecraft License. In other words, don't launch Minecraft if a user has not logged in with an account that owns the game at least once. I'm not in the mood to get sued. -Hanro

Other then that. There's a channel dedicated to GMLL on the MSMC support Discord server. Click the following badge to join.
<div>
   <a href="https://discord.gg/3hM8H7nQMA">
   <img src="https://img.shields.io/discord/861839919655944213?logo=discord"
      alt="chat on Discord"></a>
</div>
PS: If you find a bug, don't be afraid to report it on Github or Discord!  

# <b>Initialization</b>
The library relies on a collection core files that are dynamically downloaded from the internet to function. GMLL thus has two states it can be within. Initialized and uninitialized. GMLL will refuse to launch minecraft if it is not properly initialized. 

Before initialization. You'll likely want to load the config module and modify the paths GMLL uses. This is recommended as the initialization method will also create any folders required by GMLL to function. Essentially if you keep finding GMLL is generating random .minecraft folders, this is likely why. See the header "Config" under modules.

To initialize GMLL. You need to execute the init() function. 
```js
//CommonJS
const {init} = require("gmll");
init().then(...);
//ES6
import { init } from "gmll";
await init();
```
# <b>Quick start</b>
## Import the module
GMLL contains a commonJS and a ES6 versions of every internal component
```js
//ES6 
import * as gmll from "gmll";
//commonJS
const gmll = require("gmll");
```


## initialize
GMLL needs to download some manifest files and check the integraty of said files. This step stops GMLL from needing to do it everytime you want to launch something. 
```js
//async or ES6 
await gmll.init();
//sync or commonJS
gmll.init().then(()=>{...});
```
## create an instance
GMLL works with instances. Do note an instance is basically an installation of the game. The name given to the instance is used as it's ID. 
```js
const int = new gmll.instance({ version: "1.18.1", name: "my Instance" });
```
## get a login token \<Check out <a href="https://www.npmjs.com/package/msmc">MSMC</a>>
Piracy is bad, so it is best to get a GMLL login token. Luckily the author of GMLL maintains a library just for that!
```js
//async
const token = gmll.wrapper.msmc2token(await fastLaunch("raw", console.log);
//sync 
fastLaunch("raw", console.log).then(e=>{
   const token = gmll.wrapper.msmc2token(e));
   ...
})
```
## Luanch the game
Just like that you've launched the game. This will do a background check to see if everything is in place for a launch. The token we got in the step above.
```js
int.launch(token);
```

## Save and reload an instance!
GMLL will store instance settings internally!
```js
int.save();
const int2 = gmll.instance.get("my Instance");
```

# <b>Modules</b>
# index
```js
//ES6 
import * as gmll from "gmll";
//commonJS
const gmll = require("gmll");
```
The main module you will load upon pulling in GMLL. It contains fallback hooks for every other module in GMLL as well as the init function witch will initialize GMLL. See content under the header "Initialization". 

This module also contains shortcuts for setting up an the code needed to launch a new instance. Namely a direct export for the instance, player and instance options. 

For example
```js
//Let's assume the next part is in an async function!
//Needed to make sure all the needed files are downloaded
await gmll.init();
//The player profile and login token
const token = {
     profile: {
        id:"id",
        name: "Player",
        xuid: 5556345345,
        type: "msa",
        demo: true},
    access_token: "Some token"};
//Launches the game
new gmll.instance({ version: "1.18" }.launch(token);
...
```
# config
```js
//ES6 
import * as config from "gmll/config";
//commonJS
const config = require("gmll/config");
//fallback 
const config = gmll.config; 
```
The config class manages all the configuration data managed by the module. It should ideally be handled exclusively when the library has not been initialized yet as changing certain properties within the config module can cause GMLL to become uninitialized again. 

This is primarily due to this module controlling where GMLL will look and pull files from. <br><br>

## set and get functions
### Root
```ts
function getRoot(): string;
function setRoot(_root: string, absolutePath?: boolean): void;
```
<b style="color:red">Warning:</b> using "setRoot" will mark gmll as uninitialized. It will also reset all other filepaths to their default values based on the given root path. This call is used internally to set the initial filepaths. 

<b>set:</b> The set method can be used to customize where your launcher stores GMLL's data. Useful if the default location is not exactly optimal for one reason or another. If "absolutePath" is set to false (default) it will append the process directory as a prefix onto the path. Please keep this in mind as providing a relative path is likely to result in unforeseen behavior. 

<b>get:</b> In a sense the get method will give you the root directory gmll is using. Unless you're developing a plugin for GMLL and wish to use the same folder GMLL uses to store critical information and or settings. It is best to use one of the other methods below to access GMLL's files.  

### Assets
```ts
function setAssets(_assets: string): void;
function getAssets(): string;
```
The location of the assets in GMLL. Internally it should look similar to the vanilla launcher's asset's folder. Apart from the fact that certain folders aren't deleted after GMLL shuts down. 
### Libraries
```ts
function setLibraries(_libraries: string):void;
function getlibraries(): string;
```
The array of Java libraries Minecraft needs to function correctly. These two commands allow you to specify where GMLL will store them internally. 
### Instances
```ts
function setInstances(_instances: string): void;
function getInstances(): string;
```
The default location where GMLL stores the game files used by various versions of minecraft. It will contain the name of the instance which will default to the version id if a set instance is not given a name. 
### Runtimes
```ts
function setRuntimes(_runtimes: string): void;
function getRuntimes(): string;
```
The "runtimes" folder contains all the java runtimes GMLL knows about. Adding custom runtimes to this folder can technically be done, but isn't recommended. 
### Launcher/Meta
```ts
async function setLauncher(_launcher: string): Promise<void>;
export declare function getMeta(): {
   manifests: string;runtimes: string;index: string;profiles: string;temp: string;folder: string;
};
```
The launcher folder contains all the core meta data and files GMLL uses. 
It is where it will save data related to instances, manifest and core index files.
The "getMeta" function wraps all of this into an easy to handle object that contains paths to 
every folder within the meta files. The files here are more here to instruct GMLL where to get certain files from and are checked when you run the "init" command. 

The "setLauncher" is asynchronous as it will reinitialize GMLL for you when it is used. 

#### Fields
<table>
<tr><th>name</th><th>description</th></tr>
<tr><td>manifests</td><td>This file contains files used to compile the version manifest file GMLL exposes to your Launcher. Want to add a custom version? Add a file in here. Forgiac actually drops in files here and every version should have exactly one file in this folder reference it. Since the manifests files also give GMLL some data points needed to sort a set custom version. </td></tr>
<tr><td>runtimes</td><td>Contains the index files GMLL uses to download a set runtime required by a set version. The vanilla provided indexes are checked against a sha hash. Although custom runtime indexes are left alone and will be ignored unless a set version of minecraft requests it.<br><br>  <b style="color:red">Warning:</b>Contents of these indexes are different per platform. Just take that into account as you need to insure the right index is placed here for the set platform your launcher is currently running on.</td></tr>
<tr><td>index</td><td>Contains miscellaneous index files used by GMLL to get other index files or to store internal data GMLL uses to function. Please ignore unless you're developing an addon for GMLL.</td></tr>
<tr><td>profiles</td><td>Where instance config data is saved when you run the "save()" function on the profile object. </td></tr>
<tr><td>folder</td><td>Gets the root launcher folder. Useful for addons.</td></tr>
</table>

### Natives
```ts
function setNatives(_natives: string): void;
function getNatives(): string;
```
Where the natives a set version uses should be extracted to. 

### setLauncherVersion
```ts
function setLauncherVersion(_version?: string): void;
function getLauncherVersion(): string;
```
Declares the launcher version GMLL should report to Minecraft. Doesn't seem to do much of anything. 

### events 
```ts
function emit(tag: string, ...args: Array<Number | String>): void;
function setEventListener(events: Events): void;
function getEventListener(): Events;
```
This determines a few things in GMLL. Like console output and how data for a set event is processed.
If GMLL's console output is annoying then you can use the set method to feed in your own event listener. Check the JS docs for more information as the readme is likely to become outdated before long if I wrote information about it here. 

emit is an internal function and should not be used outside of GMLL. 

## Update config 
```ts
//Clears all settings
function clrUpdateConfig(): void;
//Adds a setting to the list of things GMLL should update
function addUpdateConfig(item: update): void;
//Gets the current list of things GMLL will update upon initialization
function getUpdateConfig(): update[];
```
Can be used to fine tune GMLL if your launcher isn't using all of GMLL's functions. 
For instance you can set it to only update the vanilla version manifest if you're not planning on using fabric or you can ask it to not download/update forgiac. 

## misc
```ts
//Used to resolve paths within the context of GMLL. Useful for plugin developers
function resolvePath(file: string): string;

//Used for GMLL plugins. Any function passed to this function will be called every time GMLL is initialized. 
export function initializationListener(func: () => void | Promise<void>):void;
//Does some preflight checks and is actually called by the "init" function in the index file. This can be called directly and will be no different then calling "init" in the index file.
export async function initialize();
```
Some random, but useful functions. 

# downloader
GMLL's internal download manager
# WIP Docs
Still being worked on actively. Stay tuned...