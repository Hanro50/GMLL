# GMLL
A generic Minecraft Launcher Library 

# Module type
GMLL is a hybrid module. However as such, you should best avoid trying to use GMLL as both a ES6 and a CommonJS module in the same project. 

# Initialisation
The library relies on a collection core files that are dynamically downloaded from the internet to function. GMLL thus has two states it can be within. Initialized and unitialized. GMLL will refuse to launch minecraft if it is not properly initialised. 

Before initialisation. You'll likely want to load the config module and modify the paths GMLL uses. This is recommended as the initialisation method will also create any folders required by GMLL to function. Essentially if you keep finding GMLL is generating random .minecraft folders, this is likely why. See the header "Config" under modules.

To initialise GMLL. You need to execute the init() function. 
```js
//CommonJS
const {init} = require("gmll");
init().then(...);
//ES6
import { init } from "gmll";
await init();
```

# Modules
## index
The main module you will load upon pulling in GMLL. It contains fallback hooks for every other module in GMLL as well as the init function witch will initialize GMLL. See content under the header "Initialisation"


## WIP Docs. 
