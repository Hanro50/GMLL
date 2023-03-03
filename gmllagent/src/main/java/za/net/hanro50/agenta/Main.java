package za.net.hanro50.agenta;

import java.lang.instrument.Instrumentation;
import java.lang.reflect.Array;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.URL;
import java.util.logging.Level;
import java.util.logging.Logger;

import za.net.hanro50.agenta.handler.Deligator;

public class Main {
    public final static Logger prn = Logger.getLogger("agenta");

    public static void main(String[] args) throws ClassNotFoundException, NoSuchMethodException, SecurityException,
            NegativeArraySizeException, IllegalAccessException, IllegalArgumentException, InvocationTargetException {
        prn.info("Running in static mode!");
        flight();
        String main = System.getProperty("gmll.main.class", "net.minecraft.client.main.Main");
        Class<?> C = Class.forName(main);
        Method M = C.getMethod("main", new Class[] { Array.newInstance(String.class, 0).getClass() });
        M.invoke(null, new Object[] { args });
    }

    public static void premain(String agentArgs, Instrumentation instrumentation) {
        prn.info("Running in java agent mode!");
        flight();
    }

    public static void flight() {
        System.setProperty("fml.ignoreInvalidMinecraftCertificates", "true");
        try {
            Class.forName("sun.net.www.protocol.http.Handler");
        } catch (Throwable e) {
            prn.log(Level.SEVERE, "Class \"sun.net.www.protocol.http.Handler\" is not accessable!");
            prn.log(Level.SEVERE, "\nThe following can fix this error");
            prn.log(Level.SEVERE,
                    "\t1) Try launching with the following JVM paramer \"--add-exports java.base/sun.net.www.protocol.http=ALL-UNNAMED\"");
            prn.log(Level.SEVERE, "\t2) Use java 8");
            prn.log(Level.SEVERE, "\t3) Report this error so it can be resolved! (If non of the above worked)");

            prn.log(Level.SEVERE, "\nAgenta cannot continue. Exiting...");
            System.exit(-1);
        }
        URL.setURLStreamHandlerFactory(new Deligator());
    }
}
