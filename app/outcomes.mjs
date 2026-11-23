// Résultats des litiges (page « Analyses & rapports ») : à la clôture, le service litige
// requalifie le dossier (« Résultat du litige »), par exemple en fraude. Ces chiffres montrent
// ce que deviennent réellement les litiges : part des fraudes, dossiers requalifiés, et les
// requalifications les plus fréquentes (type déclaré à l'ouverture → résultat final).

const clean = (v) =>
  String(v || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, "'")
    .trim()
    .toLowerCase();

// Un résultat est une fraude dès que son libellé contient « fraude » (Fraude étiquette,
// Fraude mauvais produit reçu…), y compris pour les libellés ajoutés par les responsables.
export const isFraud = (outcome) => clean(outcome).includes('fraude');

const pct = (n, total) => (total ? Math.round((n / total) * 100) : null);

/**
 * @param {object[]} records dossiers de la période
 * @returns {{ qualified: number, toQualify: number, fraud: number, fraudRate: number|null,
 *   fraudValue: number, requalified: number, requalifiedRate: number|null,
 *   byOutcome: { outcome: string, count: number, share: number|null, fraud: boolean }[],
 *   moves: { from: string, to: string, count: number }[] }}
 */
export function outcomeStats(records) {
  const counts = new Map();
  const moves = new Map();
  let qualified = 0,
    toQualify = 0,
    fraud = 0,
    fraudValue = 0,
    requalified = 0;
  for (const r of records || []) {
    const outcome = String(r.outcome || '').trim();
    if (!outcome) {
      if (r.status === 'Résolu') toQualify++;
      continue;
    }
    qualified++;
    counts.set(outcome, (counts.get(outcome) || 0) + 1);
    if (isFraud(outcome)) {
      fraud++;
      const value = Number(r.disputeValue) || Number(r.amount) || 0;
      fraudValue += value > 0 ? value : 0;
    }
    const from = String(r.type || '').trim();
    if (from && clean(from) !== clean(outcome)) {
      requalified++;
      const key = from + '\u0000' + outcome;
      moves.set(key, (moves.get(key) || 0) + 1);
    }
  }
  return {
    qualified,
    toQualify,
    fraud,
    fraudRate: pct(fraud, qualified),
    fraudValue: Math.round(fraudValue * 100) / 100,
    requalified,
    requalifiedRate: pct(requalified, qualified),
    byOutcome: [...counts]
      .map(([outcome, count]) => ({
        outcome,
        count,
        share: pct(count, qualified),
        fraud: isFraud(outcome),
      }))
      .sort((a, b) => b.count - a.count || a.outcome.localeCompare(b.outcome)),
    moves: [...moves]
      .map(([key, count]) => {
        const [from, to] = key.split('\u0000');
        return { from, to, count };
      })
      .sort((a, b) => b.count - a.count || a.from.localeCompare(b.from))
      .slice(0, 8),
  };
}
