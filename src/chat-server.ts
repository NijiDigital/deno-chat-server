import { readLines } from './deps.ts'

const port = 8765

const connections: Deno.Conn[] = []

const getOtherConnections = (conn: Deno.Conn): Deno.Conn[] => connections.filter(other => other !== conn)

const handleConn = async (conn: Deno.Conn) => {
  console.log(`New connection incoming: saying hello to #${conn.rid}`)
  console.log(`You are now ${connections.length} chatters`)
  const helloChunks = new TextEncoder().encode(`Hello #${conn.rid}!\n`)
  await conn.write(helloChunks)
  for await (const line of readLines(conn)) {
    const others = getOtherConnections(conn)
    const chunks = new TextEncoder().encode(`${line}\n`)
    await Promise.all(others.map(async (otherConn) => {
      console.log(`Message from #${conn.rid} to #${otherConn.rid}: ${line}`)
      await otherConn.write(chunks)
    }))
  }
}

const listener = Deno.listen({ port })
console.log(`Chat server is listening to port ${port}…`)

for await (const conn of listener) {
  connections.push(conn)
  void handleConn(conn)
}
