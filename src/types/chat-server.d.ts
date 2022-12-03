export interface ChatServer {
  getNickname(conn: Deno.Conn): string

  getOtherConnections(conn: Deno.Conn): Deno.Conn[]

  logActivity(msg: string): void

  logSystem(msg: string): void

  setNickname(conn: Deno.Conn, newNickname: string): void

  start(): Promise<void>

  stop(): Promise<void>

  talk(target: Deno.Conn | Deno.Conn[], msg: string): Promise<void>
}

