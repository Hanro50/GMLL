package za.net.hanro50.agenta;

import java.lang.instrument.Instrumentation;
import java.lang.reflect.Array;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.URL;

import za.net.hanro50.agenta.handler.Deligator;

public class Main {
    private static boolean init = false;

    public static void main(String[] args) throws ClassNotFoundException, NoSuchMethodException, SecurityException,
            NegativeArraySizeException, IllegalAccessException, IllegalArgumentException, InvocationTargetException,
            InstantiationException {
        Prt.info("Running in static mode!");
        flight();

        String main = System.getProperty("gmll.main.class", "net.minecraft.client.main.Main");
        Class<?> C = Class.forName(main);
        Method M = C.getMethod("main", new Class[] { Array.newInstance(String.class, 0).getClass() });
        M.invoke(null, new Object[] { args });
    }

    public static void premain(String agentArgs, Instrumentation instrumentation) {
        Prt.info("Running in java agent mode!");
        flight();
    }

    public static void flight() {
        if (init)
            return;
        System.setProperty("fml.ignoreInvalidMinecraftCertificates", "true");
        try {
            Class.forName("sun.net.www.protocol.http.Handler").getConstructor().newInstance();
        } catch (Throwable e) {
            Prt.log(Prt.LEVEL.FETAL, "Class \"sun.net.www.protocol.http.Handler\" is not accessable!");
            Prt.log(Prt.LEVEL.FETAL, "\nThe following can fix this error");
            Prt.log(Prt.LEVEL.FETAL,
                    "\t1) Try launching with the following JVM paramer \"--add-exports java.base/sun.net.www.protocol.http=ALL-UNNAMED\"");
            Prt.log(Prt.LEVEL.FETAL, "\t2) Use java 8");
            Prt.log(Prt.LEVEL.FETAL, "\t3) Report this error so it can be resolved! (If non of the above worked)");

            Prt.log(Prt.LEVEL.FETAL, "\nSupport (discord): https://discord.gg/f7THdzEPH2");
            Prt.log(Prt.LEVEL.FETAL, "Agenta cannot continue. Exiting...");
            try {
                Class.forName("System").getMethod("exit", Integer.class).invoke(null, -1);
            } catch (Exception err) {
                throw new RuntimeException();
            }

        }
        URL.setURLStreamHandlerFactory(new Deligator());
        init = true;
    }
}
