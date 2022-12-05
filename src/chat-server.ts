import { readLines } from './deps.ts'

const port = 8765

const handleConn = async (conn: Deno.Conn) => {
  console.log(`New connection incoming: saying hello to #${conn.rid}`)
  const helloChunks = new TextEncoder().encode(`Hello #${conn.rid}!\n`)
  await conn.write(helloChunks)
  for await (const line of readLines(conn)) {
    console.log('Received line:', line)
  }
}

const listener = Deno.listen({ port })
console.log(`Chat server is listening to port ${port}…`)

for await (const conn of listener) {
  void handleConn(conn)
}
