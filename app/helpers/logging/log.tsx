export default class log {
  public static info(from: string, message: string) {
    console.info(from + " " + message);
  }

  public static error(from: string, message: string) {
    console.error(from + " " + message);
  }
}
