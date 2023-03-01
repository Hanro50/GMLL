package za.net.hanro50.gmll;

import java.lang.instrument.ClassFileTransformer;
import java.lang.instrument.Instrumentation;
import java.security.ProtectionDomain;

import org.apache.ibatis.javassist.ClassPool;
import org.apache.ibatis.javassist.CtClass;
import org.apache.ibatis.javassist.CtMethod;

public final class App implements ClassFileTransformer {
  final static String targetClassName = "java.net.URL";
  final static String codeFix = "{return this.openConnection();}";
  public static void premain(String agentArgs, Instrumentation instrumentation) throws ClassNotFoundException {
    System.out.println("[Agent] Loading...");
    Class<?> clazz = Class.forName(targetClassName);
    instrumentation.addTransformer(new App(), true);
    try {
      instrumentation.retransformClasses(clazz);
    } catch (Exception ex) {
      throw new RuntimeException(
          "[Agent] Transform failed for: [" + clazz.getName() + "]", ex);
    }
  }
  public static String dotToPath(String dot){
    return dot.replaceAll("\\.", "/");
  }
  @Override
  public byte[] transform(ClassLoader loader, String className, Class<?> classBeingRedefined,
      ProtectionDomain protectionDomain, byte[] classfileBuffer) {

    byte[] byteCode = classfileBuffer;
    String finalTargetClassName = dotToPath(targetClassName);
    if (!className.equals(finalTargetClassName)) {
      return byteCode;
    }
    System.out.println("[Agent] Transforming class "+targetClassName);
    try {
      ClassPool cp = ClassPool.getDefault();
      CtClass cc = cp.get(targetClassName);
      CtClass[] cproxy = { cp.get("java/net/Proxy") };
      if (cproxy[0] == null) {
        System.out.println("NULL!");
      }
      CtMethod method = cc.getDeclaredMethod("openConnection", cproxy);
      method.insertBefore(codeFix);
      byteCode = cc.toBytecode();
      cc.detach();
    } catch (Exception e) {
      e.getStackTrace();
    }
    return byteCode;
  }
}