export const isArray = <T>(o: T | T[]): o is T[] => typeof o === 'object' && !!o && 'length' in o

export const tryToCloseConn = (conn: Deno.Conn) => {
  try {
    conn.close()
  } catch {
    // Do not remove
  }
}
