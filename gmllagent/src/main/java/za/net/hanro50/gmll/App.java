package za.net.hanro50.gmll;

import java.lang.instrument.Instrumentation;
import java.lang.instrument.ClassFileTransformer;
import java.security.ProtectionDomain;

import org.apache.ibatis.javassist.ClassPool;
import org.apache.ibatis.javassist.CtClass;
import org.apache.ibatis.javassist.CtMethod;
/**
 * Hello world!
 */
public final class App {
  public static void premain(
      String agentArgs, Instrumentation inst) {
    System.out.println("[Agent] In premain method");
    String className = "java.net.URL";
    transformClass(className, inst);
  }

  public static void agentmain(
      String agentArgs, Instrumentation inst) {
    System.out.println("[Agent] In agentmain method");
    String className = "java.net.URL";
    transformClass(className, inst);
  }

  private static void transformClass(
      String className, Instrumentation instrumentation) {

    Class<?> targetCls = null;
    ClassLoader targetClassLoader = null;
    try {
      targetCls = Class.forName(className);
      targetClassLoader = targetCls.getClassLoader();
      transform(targetCls, targetClassLoader, instrumentation);
      return;
    } catch (Exception ex) {
      System.out.println("Class [{}] not found with Class.forName");
    }
    // otherwise iterate all loaded classes and find what we want
    for (Class<?> clazz : instrumentation.getAllLoadedClasses()) {
      if (clazz.getName().equals(className)) {
        targetCls = clazz;
        targetClassLoader = targetCls.getClassLoader();
        transform(targetCls, targetClassLoader, instrumentation);
        return;
      }
    }
    throw new RuntimeException(
        "Failed to find class [" + className + "]");
  }

  private static void transform(
      Class<?> clazz,
      ClassLoader classLoader,
      Instrumentation instrumentation) {
    Refactor dt = new Refactor(
        clazz.getName(), classLoader);
    instrumentation.addTransformer(dt, true);
    try {
      instrumentation.retransformClasses(clazz);
    } catch (Exception ex) {
      throw new RuntimeException(
          "Transform failed for: [" + clazz.getName() + "]", ex);
    }
  }
}