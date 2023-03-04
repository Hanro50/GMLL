package za.net.hanro50.mod;

import java.util.logging.Level;
import java.util.logging.Logger;

import org.bukkit.plugin.java.JavaPlugin;

import za.net.hanro50.agenta.Main;
import za.net.hanro50.agenta.Prt;
import za.net.hanro50.agenta.Prt.LEVEL;
import za.net.hanro50.agenta.Prt.Log;

public class AgentaPlugin extends JavaPlugin {
    private class bukkitLogger implements Log {
        private Logger logger;

        public bukkitLogger() {
            logger = getLogger();
            if (logger != null) {
                Prt.systemLogger = this;
                Prt.info("Using Bukkit logger");
            }
        }

        @Override
        public void log(LEVEL level, String string2, Object... args) {

            string2 = String.format(string2, args);
            switch (level) {
                case ERROR:
                    logger.warning(string2);
                    break;
                case FETAL:
                    logger.log(Level.SEVERE, string2);
                    break;
                default:
                case INFO:
                    logger.info(string2);
                    break;
            }
        }
    }

    public void onLoad() {
    }

    public void onEnable() {
        try {
            new bukkitLogger();
        } catch (Throwable e) {
        }
        Prt.info("Starting as Bukkit plugin");
        Main.flight();
    }

    public void onDisable() {
    }
}
