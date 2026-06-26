// Stocke { res, role } pour filtrer les broadcasts par rôle
const clients = new Set();

module.exports = {
  add(res, role) {
    clients.add({ res, role });
  },
  remove(res) {
    for (const client of clients) {
      if (client.res === res) { clients.delete(client); break; }
    }
  },
  broadcast(data, allowedRoles = ['ADMIN', 'SUPERVISEUR']) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    clients.forEach((client) => {
      if (allowedRoles.includes(client.role)) {
        client.res.write(payload);
      }
    });
  },
};
