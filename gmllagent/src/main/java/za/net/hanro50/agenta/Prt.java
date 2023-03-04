package za.net.hanro50.agenta;

import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

public class Prt {
    public static enum LEVEL {
        FETAL,
        ERROR,
        INFO
    }

    public static Log systemLogger;
    static {
        try {
            systemLogger = new log4jImp();
        } catch (Throwable w) {
            systemLogger = new sysImp();
        }
    }

    static class log4jImp implements Log {
        Logger logger1;

        public log4jImp() {
            logger1 = LogManager.getLogger("Agenta");

        }

        @Override
        public void log(LEVEL level, String string2,Object ...args) {
            string2 = String.format(string2, args);
            switch (level) {
                case ERROR:
                    logger1.warn(string2);
                    break;
                case FETAL:
                    logger1.log(Level.FATAL, string2);
                    break;
                default:
                case INFO:
                    logger1.info(string2);
                    break;
            }
        }

    }

    public static class sysImp implements Log {

        @Override
        public void log(LEVEL level, String string2,Object ...args) {
            string2 = String.format(string2, args);
            switch (level) {
                case ERROR:
                    System.err.println("\033[1;33m" + string2 + "\033[0m");
                    break;
                case FETAL:
                    System.err.println("\033[1;31m" + string2 + "\033[0m");
                    break;
                default:
                case INFO:
                System.out.println("\033[0m" + string2 );
                    break;
            }

        }

    }

    static public interface Log {

        void log(LEVEL level, String string2,Object ...args);

    }

    public static void info(String info,Object ...args) {
        log(LEVEL.INFO, info,args);
    }
    // public final static Logger prn = LogManager.getLogger("agenta");

    public static void log(LEVEL level, String messsage,Object ...args) {
        systemLogger.log(level, messsage,args);
    }

    public static void warn(String wrn,Object ...args) {
        log(LEVEL.ERROR, wrn,args);
    }

}
