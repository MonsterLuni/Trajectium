import log from "./logging/log";

export default class Utility {
  public static ensureValue<T>(
    name: string,
    value: T,
  ): asserts value is NonNullable<T> {
    if (value == null) {
      log.error(name, "is null");
      throw new Error(`${name} is null`);
    }
    if (!value) {
      log.error(name, "is undefined");
      throw new Error(`${name} is undefined`);
    }
  }
}
