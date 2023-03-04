package za.net.hanro50.mod;

import za.net.hanro50.agenta.Main;
import za.net.hanro50.agenta.Prt;
import za.net.hanro50.agenta.Prt.sysImp;

public class Commom {
    static public void load(String src) {
        if (Prt.systemLogger instanceof sysImp)
            new FmlPrt();

        Prt.info("Starting as " + src + " mod?!");
        Main.flight();
    }
}
