import { readLines } from './deps.ts'

const port = 8765

const connections: Deno.Conn[] = []

const handleConn = async (conn: Deno.Conn) => {
  console.log(`New connection incoming: saying hello to #${conn.rid}`)
  console.log(`You are now ${connections.length} chatters`)
  const helloChunks = new TextEncoder().encode(`Hello #${conn.rid}!\n`)
  await conn.write(helloChunks)
  for await (const line of readLines(conn)) {
    console.log('Received line:', line)
  }
}

const listener = Deno.listen({ port })
console.log(`Chat server is listening to port ${port}…`)

for await (const conn of listener) {
  connections.push(conn)
  void handleConn(conn)
}
