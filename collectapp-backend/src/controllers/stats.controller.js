const db = require('../config/db');
const sseClients = require('../utils/sseClients');

const today = () => new Date().toISOString().slice(0, 10);

exports.dashboard = async (req, res, next) => {
  try {
    const dateJour = today();
    const [totalActifs] = await db('cotisants').where({ actif: true }).count('id as count');
    const [payes] = await db('paiements')
      .where({ date: dateJour })
      .where('statut', '!=', 'annule')
      .countDistinct('cotisant_id as count');

    const montants = await db('paiements')
      .where({ date: dateJour, statut: 'paye' })
      .groupBy('mode')
      .select('mode')
      .sum('montant as total');

    const nonPayes = parseInt(totalActifs.count) - parseInt(payes.count);

    res.json({
      date: dateJour,
      total_cotisants: parseInt(totalActifs.count),
      payes: parseInt(payes.count),
      non_payes: nonPayes,
      montants_par_mode: montants,
    });
  } catch (err) { next(err); }
};

exports.tauxCollecte = async (req, res, next) => {
  try {
    const { date = today() } = req.query;
    const [total] = await db('cotisants').where({ actif: true }).count('id as count');
    const [payes] = await db('paiements')
      .where({ date })
      .where('statut', '!=', 'annule')
      .countDistinct('cotisant_id as count');
    const taux = total.count > 0
      ? ((payes.count / total.count) * 100).toFixed(1)
      : 0;
    res.json({ date, taux_collecte: parseFloat(taux), payes: parseInt(payes.count), total: parseInt(total.count) });
  } catch (err) { next(err); }
};

exports.classementCommerciaux = async (req, res, next) => {
  try {
    const { debut, fin = today() } = req.query;
    const dateDebut = debut || fin;
    const classement = await db('paiements')
      .join('utilisateurs', 'paiements.commercial_id', 'utilisateurs.id')
      .whereBetween('paiements.date', [dateDebut, fin])
      .where('paiements.statut', 'paye')
      .groupBy('paiements.commercial_id', 'utilisateurs.nom')
      .select('utilisateurs.nom', 'paiements.commercial_id')
      .count('paiements.id as nb_paiements')
      .sum('paiements.montant as total_collecte')
      .orderBy('total_collecte', 'desc');
    res.json(classement);
  } catch (err) { next(err); }
};

exports.retardataires = async (req, res, next) => {
  try {
    // « En retard de N jours » = aucun paiement sur les N derniers jours (aujourd'hui inclus).
    // N=1 → pas payé aujourd'hui.
    const n = Math.max(1, parseInt(req.query.jours, 10) || 1);
    const dateRef = new Date();
    dateRef.setDate(dateRef.getDate() - (n - 1));
    const refStr = dateRef.toISOString().slice(0, 10);

    const retardataires = await db('cotisants')
      .where('cotisants.actif', true)
      .whereNotIn('cotisants.id', function () {
        this.select('cotisant_id')
          .from('paiements')
          .where('date', '>=', refStr)
          .where('statut', '!=', 'annule');
      })
      .join('utilisateurs', 'cotisants.commercial_id', 'utilisateurs.id')
      .select('cotisants.*', 'utilisateurs.nom as commercial_nom');

    res.json({ jours: n, count: retardataires.length, retardataires });
  } catch (err) { next(err); }
};

exports.export = async (req, res, next) => {
  try {
    const { debut, fin = today(), format = 'csv' } = req.query;
    const dateDebut = debut || fin;

    const paiements = await db('paiements')
      .whereBetween('date', [dateDebut, fin])
      .join('cotisants', 'paiements.cotisant_id', 'cotisants.id')
      .leftJoin('utilisateurs', 'paiements.commercial_id', 'utilisateurs.id')
      .select(
        'paiements.id',
        'paiements.date',
        'cotisants.nom as cotisant',
        'cotisants.telephone',
        'paiements.montant',
        'paiements.mode',
        'paiements.statut',
        'utilisateurs.nom as commercial'
      )
      .orderBy('paiements.date', 'desc');

    if (format === 'csv') {
      const header = 'ID,Date,Cotisant,Telephone,Montant,Mode,Statut,Commercial\n';
      const rows = paiements.map(p =>
        `${p.id},${p.date},"${p.cotisant}",${p.telephone},${p.montant},${p.mode},${p.statut},"${p.commercial || ''}"`
      ).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=paiements_${dateDebut}_${fin}.csv`);
      return res.send(header + rows);
    }

    res.json(paiements);
  } catch (err) { next(err); }
};

// SSE — tableau de bord temps réel
exports.sseEvents = (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED' })}\n\n`);

  const heartbeat = setInterval(() => res.write(':ping\n\n'), 30000);
  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.remove(res);
  });
};
