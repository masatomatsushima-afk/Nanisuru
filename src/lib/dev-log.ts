/** Dev-only logging — never prints in production builds. */
export function devLog(tag: string, ...args: unknown[]): void {
  if (__DEV__) {
    console.log(tag, ...args);
  }
}

export function devWarn(tag: string, ...args: unknown[]): void {
  if (__DEV__) {
    console.warn(tag, ...args);
  }
}
