export type Result<T, E = string> = { success: true; data: T } | { success: false; error: E }

/** Wraps a value in a successful Result. */
export const ok = <T>(data: T): Result<T, never> => ({ success: true, data })

/** Wraps an error in a failed Result. */
export const fail = <E = string>(error: E): Result<never, E> => ({ success: false, error })

/**
 * Wraps an async function that returns Result<T>, catching any thrown errors and converting them
 * to fail(error.message). Use in service methods that compose repo calls and business logic —
 * repos throw on not-found, tryCatch converts to Result.
 */
export async function tryCatch<T>(fn: () => Promise<Result<T>>) {
  try {
    return await fn()
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}
