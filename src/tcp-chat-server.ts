import type { ChatServer } from './types/chat-server.d.ts'
import { blue, bold, green, readLines, yellow } from './deps.ts'
import { isArray, tryToCloseConn } from './helper.ts'
import { chatCommands } from './commands.ts'

class TcpChatServer implements ChatServer {
  static readonly commandPrefix = '.'

  static #defaultNickname(conn: Deno.Conn) {
    return `Buddy#${conn.rid}`
  }

  readonly #port: number
  #connections: Deno.Conn[] = []
  #listener?: Deno.Listener
  #nicknames: Record<string, string> = {}
  #listenerPromise?: Promise<void>
  #watchdogTimer?: number

  constructor(options?: { port?: number }) {
    this.#port = options?.port ?? 8765
  }

  #addConn(conn: Deno.Conn) {
    this.#connections.push(conn)
    this.#nicknames[conn.rid] = TcpChatServer.#defaultNickname(conn)
  }

  #destroyConn(conn: Deno.Conn) {
    tryToCloseConn(conn)
    const index = this.#connections.indexOf(conn)
    if (index !== -1) {
      this.logActivity(`${this.getNickname(conn)} leaved.`)
      this.#connections.splice(index, 1)
      delete this.#nicknames[conn.rid]
      this.#reportChatters()
    }
  }

  #findConnection(nickname: string): Deno.Conn | undefined {
    const ridString = Object.keys(this.#nicknames).find((key) => this.#nicknames[key] === nickname)
    const rid = ridString && Number(ridString)
    return rid ? this.#connections.find(conn => conn.rid === rid) : undefined
  }

  async #handleCommand(conn: Deno.Conn, command: string, args: string[]): Promise<boolean> {
    const commandFn = chatCommands[command]
    if (!commandFn) {
      return false
    }
    const result = await commandFn.call(this, conn, ...args)
    return !(result === false)
  }

  #searchMentions(line: string): Deno.Conn[] {
    const mentionPattern = /@(\w+)/g
    const nickMentions = []
    while (true) {
      const matches = mentionPattern.exec(line)
      if (!matches) {
        break
      }
      nickMentions.push(matches[1])
    }
    return nickMentions.reduce<Deno.Conn[]>((acc, nickMention) => {
      const conn = this.#findConnection(nickMention)
      return conn ? [...acc, conn] : acc
    }, [])
  }

  async #handleConn(conn: Deno.Conn) {
    this.logSystem(`${this.getNickname(conn)} just entered.`)
    await this.talk(this.getOtherConnections(conn), `${this.getNickname(conn)} just entered.`)
    this.#reportChatters()
    await this.talk(conn, `Hello ${this.getNickname(conn)}!`)
    try {
      for await (const line of readLines(conn)) {
        const mentions = this.#searchMentions(line)
        const target = mentions.length ? mentions : this.getOtherConnections(conn)
        if (line.startsWith(TcpChatServer.commandPrefix)) {
          const [command, ...args] = line.slice(1).split(' ')
          const nickname = this.getNickname(conn)
          const commandHandled = await this.#handleCommand(conn, command, args)
          if (commandHandled) {
            this.logSystem(`${nickname} executed command: ${command} ${args.join(' ')}`)
          }
          continue
        }
        const nickname = this.getNickname(conn)
        const targetDesc = isArray(target) ? 'to all' : `to ${this.getNickname(target)}`
        this.logActivity(`${nickname} said ${targetDesc}: ${line}`)
        const msg = `From ${nickname}: ${line}`
        await this.talk(target, msg)
      }
    } catch (err) {
      if (err instanceof Deno.errors.BadResource) {
        return
      }
      console.warn(err.message)
    }
  }

  #reportChatters() {
    if (this.#connections.length > 0) {
      this.logActivity(`You are now ${this.#connections.length} chatter${this.#connections.length > 1 ? 's' : ''}.`)
    } else {
      this.logActivity(`No chatter connected.`)
    }
  }

  getNickname(conn: Deno.Conn) {
    return this.#nicknames[conn.rid]
  }

  getOtherConnections(conn: Deno.Conn) {
    return this.#connections.filter(other => other !== conn)
  }

  logActivity(msg: string) {
    console.log(`${green('>')} ${msg}`)
  }

  logSystem(msg: string) {
    console.log(`${yellow(']')} ${msg}`)
  }

  setNickname(conn: Deno.Conn, newNickname: string) {
    this.#nicknames[conn.rid] = newNickname
  }

  async start() {
    const port = this.#port
    this.logSystem(`Trying to bind port ${port}…`)
    const listener = Deno.listen({ port })
    this.#listener = listener
    const watchdogChunk = new Uint8Array({ length: 1 })
    this.#watchdogTimer = setInterval(() => {
      this.#connections.map(async (conn) => {
        try {
          await conn.write(watchdogChunk)
        } catch (err) {
          this.#destroyConn(conn)
        }
      })
    }, 100)
    this.logSystem('Watch dog timer started.')
    this.#listenerPromise = (async () => {
      for await (const conn of listener) {
        this.#addConn(conn)
        void this.#handleConn(conn)
      }
    })()
    this.logSystem(`Chat server started.`)
    this.logSystem(`Please type to connect: nc localhost ${port}.`)
  }

  async stop() {
    this.logSystem('Chat server shutdown incoming…')
    clearInterval(this.#watchdogTimer)
    this.#watchdogTimer = undefined
    this.#connections.forEach(conn => {
      this.#destroyConn(conn)
    })
    this.#listener?.close()
    await this.#listenerPromise
    this.logSystem('Chat server stopped.')
  }

  async talk(target: Deno.Conn | Deno.Conn[], msg: string) {
    if (isArray(target)) {
      await Promise.all(target.map(async (item) => this.talk(item, msg)))
      return
    }
    const chunks = new TextEncoder().encode(`${blue(bold('>'))} ${msg}\n`)
    try {
      await target.write(chunks)
    } catch (err) {
      console.warn(err.message)
      this.#destroyConn(target)
    }
  }
}

export { TcpChatServer }

if (import.meta.main) {
  void new TcpChatServer().start()
}
