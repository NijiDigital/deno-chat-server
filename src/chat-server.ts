import { readLines } from './deps.ts'

const port = 8765

const connections: Deno.Conn[] = []

const nicknames: Record<number, string> = {}

const addConn = (conn: Deno.Conn) => {
  connections.push(conn)
  nicknames[conn.rid] = `Buddy#${conn.rid}`
}

const getOtherConnections = (conn: Deno.Conn): Deno.Conn[] => connections.filter(other => other !== conn)

const destroyConn = (conn: Deno.Conn) => {
  tryToClose(conn)
  const index = connections.indexOf(conn)
  if (index !== -1) {
    console.log(`Connection #${conn.rid} leaved`)
    connections.splice(index, 1)
    delete nicknames[conn.rid]
    reportChatters()
  }
}

const shutdown = () => {
  console.log('Chat server shutdown incoming…')
  clearInterval(watchdogTimer)
  connections.forEach(conn => {
    destroyConn(conn)
  })
  listener.close()
}

const reportChatters = () => {
  if (connections.length > 0) {
    console.log(`You are now ${connections.length} chatter${connections.length > 1 ? 's' : ''}`)
  } else {
    console.log(`No chatter connected`)
  }
}

const tryToClose = (conn: Deno.Conn) => {
  try {
    conn.close()
  } catch {
    // Do not remove
  }
}

const talkToOthers = async (conn: Deno.Conn, line: string) => {
  const nickname = nicknames[conn.rid]
  const others = getOtherConnections(conn)
  await Promise.all(others.map(async (otherConn) => {
    const chunks = new TextEncoder().encode(`From ${nickname}: ${line}\n`)
    console.log(`Message from ${nickname} to ${nicknames[otherConn.rid]}: ${line}`)
    try {
      await otherConn.write(chunks)
    } catch (err) {
      console.warn(err.message)
      destroyConn(otherConn)
    }
  }))
}

const handleCommand = (conn: Deno.Conn, command: string, args: string[]) => {
  switch (command) {
    case 'nick': {
      changeNick(conn, args[0])
      break
    }
    case 'shutdown': {
      shutdown()
    }
  }
}

const changeNick = (conn: Deno.Conn, newNickname: string) => {
  console.log(`Change of nickname: ${nicknames[conn.rid]} => ${newNickname}`)
  nicknames[conn.rid] = newNickname
}

const handleConn = async (conn: Deno.Conn) => {
  console.log(`New connection incoming: saying hello to ${nicknames[conn.rid]}`)
  reportChatters()
  const nickname = nicknames[conn.rid]
  const helloChunks = new TextEncoder().encode(`Hello ${nickname}!\n`)
  await conn.write(helloChunks)
  for await (const line of readLines(conn)) {
    if (line.startsWith('.')) {
      const [command, ...args] = line.slice(1).split(' ')
      handleCommand(conn, command, args)
    } else {
      await talkToOthers(conn, line)
    }
  }
}

const listener = Deno.listen({ port })
console.log(`Chat server is listening to port ${port}…`)

const watchdogChunk = new Uint8Array({ length: 1 })
const watchdogTimer = setInterval(() => {
  connections.map(async (conn) => {
    try {
      await conn.write(watchdogChunk)
    } catch {
      destroyConn(conn)
    }
  })
}, 100)
console.log('Watch dog timer started')

for await (const conn of listener) {
  addConn(conn)
  void handleConn(conn)
}

console.log('Chat server end')
