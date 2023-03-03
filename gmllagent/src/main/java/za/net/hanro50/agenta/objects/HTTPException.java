package za.net.hanro50.agenta.objects;

public class HTTPException extends Throwable {
  final int status;
  
  public HTTPException(String url, int status) {
    this(url, status, "ERROR WITH CODE " + status);
  }
  
  public HTTPException(String url, int status, String responseMessage) {
    super("Failed to get " + url + "\n\t" + responseMessage);
    this.status = status;
  }
}
