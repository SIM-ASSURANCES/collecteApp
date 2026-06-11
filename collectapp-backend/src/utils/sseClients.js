const clients = new Set();

module.exports = {
  add:    (res) => clients.add(res),
  remove: (res) => clients.delete(res),
  broadcast(data) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    clients.forEach((client) => client.write(payload));
  },
};
