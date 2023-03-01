package za.net.hanro50.gmll;

import java.lang.instrument.ClassFileTransformer;
import java.security.ProtectionDomain;

import org.apache.ibatis.javassist.ClassPool;
import org.apache.ibatis.javassist.CtClass;
import org.apache.ibatis.javassist.CtMethod;

public class Refactor implements ClassFileTransformer {
  private String targetClassName;

  public Refactor(String name, ClassLoader classLoader) {
    targetClassName = name;
  }
  static public void run() {
    System.out.println("HELLO WORLD!");
    (new Error()).printStackTrace();
  }
  @Override
  public byte[] transform(
      ClassLoader loader,
      String className,
      Class<?> classBeingRedefined,
      ProtectionDomain protectionDomain,
      byte[] classfileBuffer) {
    byte[] byteCode = classfileBuffer;
    String finalTargetClassName = this.targetClassName
        .replaceAll("\\.", "/");
    if (!className.equals(finalTargetClassName)) {
      return byteCode;
    }
    System.out.println(className);
    System.out.println(finalTargetClassName);

      System.out.println("[Agent] Transforming class MyAtm");
      try {
        ClassPool cp = ClassPool.getDefault();
        CtClass cc = cp.get(targetClassName);
        CtClass[] cproxy = { cp.get("java/net/Proxy") };
        if (cproxy[0] == null) {
          System.out.println("NULL!");
        }
        System.out.println("[Agent] Transforming class MyAtm 2");
        CtMethod method = cc.getDeclaredMethod("openConnection", cproxy);
        method.insertBefore("{return this.openConnection();}");
        byteCode = cc.toBytecode();
        cc.detach();
      } catch (Exception e) {
        e.getStackTrace();
      }
    return byteCode;
  }
}
