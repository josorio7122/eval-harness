export type Result<T, E = string> = { success: true; data: T } | { success: false; error: E }

export const ok = <T>(data: T): Result<T, never> => ({ success: true, data })
export const fail = <E = string>(error: E): Result<never, E> => ({ success: false, error })
