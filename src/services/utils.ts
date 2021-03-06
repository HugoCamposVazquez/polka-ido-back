import deployments from "@nodefactoryio/ryu-contracts/deployments/deployments.json";

import { logger } from "./logger";

export interface IRetryOptions {
  /**
   * The maximum amount of times to retry the operation. Default is 5
   */
  retries?: number;
  /**
   * An optional Function that is invoked after the provided callback throws
   * It expects a boolean to know if it should retry or not
   * Useful to make retrying conditional on the type of error thrown
   */
  shouldRetry?: (lastError: Error) => boolean;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitFor(
  predicate: () => Promise<boolean> | boolean,
  { interval = 500, timeout = 10000 } = {}
): Promise<boolean> {
  const asyncPredicate = (): unknown => Promise.resolve(predicate());

  let elapsed = 0;

  while (!(await asyncPredicate())) {
    if (elapsed > timeout) {
      throw Error("Timeout");
    }

    await sleep(interval);
    elapsed += interval;
  }

  return true;
}

/**
 * Retry a given function on error.
 * @param fn Async callback to retry. Invoked with 1 parameter
 * A Number identifying the attempt. The absolute first attempt (before any retries) is 1
 * @param opts
 */
export async function retry<A>(
  fn: (attempt: number) => A | Promise<A>,
  opts?: IRetryOptions
): Promise<A> {
  const maxRetries = opts?.retries || 5;
  const shouldRetry = opts?.shouldRetry;

  let lastError: Error = Error("RetryError");
  for (let i = 1; i <= maxRetries; i++) {
    try {
      return await fn(i);
    } catch (e) {
      lastError = e as Error;
      logger.warn(e);
      if (shouldRetry && !shouldRetry(lastError)) {
        break;
      }
    }
  }
  throw lastError;
}

export function getFactoryContractAddress(
  chainId: number,
  network: string,
  factoryName: string
): string | null {
  const factoryContractAddress =
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    deployments[chainId]?.[network]?.contracts[factoryName]?.address;
  if (!factoryContractAddress) {
    return null;
  }

  return factoryContractAddress;
}
