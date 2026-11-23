// Rôles de l'outil et ce que chacun peut faire, en un seul endroit.
//
// - RC, SAV : créent les litiges et les suivent.
// - Service Litige : traite les litiges, les transporteurs et les avoirs.
// - Responsable : rôle créé le 20/11/2026 ; en attendant que ses droits soient définis, il fait
//   comme le Service Litige et voit Analyses litiges (À DÉFINIR : voir POINT_REPRISE.md).
// - Admin (anciennement « Responsables ») : tout, dont Équipe & accès, Paramètres, Contentieux.

export const ROLES = ['RC', 'SAV', 'Service Litige', 'Responsable', 'Admin'];

/** Administrateur de l'outil : équipe, paramètres, contentieux, validations d'avoir */
export const isAdmin = (role) => role === 'Admin';

/** Traite les litiges (traitement, transporteur, montants, avoirs) */
export const treatsDisputes = (role) => ['Service Litige', 'Responsable', 'Admin'].includes(role);

/** Voit le menu « Analyses litiges » */
export const seesAnalytics = (role) => ['Service Litige', 'Responsable', 'Admin'].includes(role);

/** Crée et suit ses propres litiges (« Ma data » : ses propres chiffres) */
export const createsDisputes = (role) => role === 'RC' || role === 'SAV';
