import type { ChatServer } from './chat-server.d.ts'

export type Command<T extends ChatServer> = (this: T, conn: Deno.Conn, ...args: string[]) => Promise<boolean | void>
export type Commands<T extends ChatServer> = Record<string, Command<T>>
