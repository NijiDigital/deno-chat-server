import { readLines } from './deps.ts'

const port = 8765

const connections: Deno.Conn[] = []

const getOtherConnections = (conn: Deno.Conn): Deno.Conn[] => connections.filter(other => other !== conn)

const destroyConn = (conn: Deno.Conn) => {
  tryToClose(conn)
  const index = connections.indexOf(conn)
  if (index !== -1) {
    console.log(`Connection #${conn.rid} leaved`)
    connections.splice(index, 1)
    reportChatters()
  }
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

const handleConn = async (conn: Deno.Conn) => {
  console.log(`New connection incoming: saying hello to #${conn.rid}`)
  reportChatters()
  const helloChunks = new TextEncoder().encode(`Hello #${conn.rid}!\n`)
  await conn.write(helloChunks)
  for await (const line of readLines(conn)) {
    const others = getOtherConnections(conn)
    const chunks = new TextEncoder().encode(`${line}\n`)
    await Promise.all(others.map(async (otherConn) => {
      console.log(`Message from #${conn.rid} to #${otherConn.rid}: ${line}`)
      try {
        await otherConn.write(chunks)
      } catch (err) {
        console.warn(err.message)
        destroyConn(otherConn)
      }
    }))
  }
}

const listener = Deno.listen({ port })
console.log(`Chat server is listening to port ${port}…`)

const watchdogChunk = new Uint8Array({ length: 1 })
setInterval(() => {
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
  connections.push(conn)
  void handleConn(conn)
}
