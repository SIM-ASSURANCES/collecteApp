// Blacklist en mémoire des JTI révoqués (jti → expiry timestamp ms)
// Nettoyage automatique pour éviter la croissance illimitée
const revoked = new Map();

function revoke(jti, exp) {
  revoked.set(jti, exp * 1000); // exp JWT est en secondes
}

function isRevoked(jti) {
  if (!revoked.has(jti)) return false;
  if (Date.now() > revoked.get(jti)) {
    revoked.delete(jti); // token expiré naturellement, plus besoin de le garder
    return false;
  }
  return true;
}

// Nettoyage des entrées expirées toutes les heures
setInterval(() => {
  const now = Date.now();
  for (const [jti, exp] of revoked) {
    if (now > exp) revoked.delete(jti);
  }
}, 60 * 60 * 1000);

module.exports = { revoke, isRevoked };
