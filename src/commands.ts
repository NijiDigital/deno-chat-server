import type { ChatServer } from './types/chat-server.d.ts'
import type { Commands } from './types/command.d.ts'

const chatCommands: Commands<ChatServer> = {
  nick: async function(this: ChatServer, conn: Deno.Conn, newNickname?: string) {
    if (!newNickname) {
      throw new Error('Missing new nickname')
    }
    const otherConnections = this.getOtherConnections(conn)
    await this.talk(otherConnections, `${this.getNickname(conn)} changed nickname to ${newNickname}`)
    this.setNickname(conn, newNickname)
    await this.talk(conn, 'Done.')
  },
  shutdown: async function(this: ChatServer) {
    await this.stop()
  },
}

export { chatCommands }
