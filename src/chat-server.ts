const port = 8765

const listener = Deno.listen({ port })
console.log(`Chat server is listening to port ${port}…`)

for await (const conn of listener) {
  console.log(`New connection incoming: saying hello to #${conn.rid}`)
  const helloChunks = new TextEncoder().encode(`Hello #${conn.rid}!\n`)
  await conn.write(helloChunks)
}
