'use client';
import { ExternalLink, Truck } from 'lucide-react';
import type { Dossier } from './types';

interface CarrierPlatformProps {
  record: Dossier;
  canEdit: boolean;
}

// Espace « Plateforme du transporteur » (onglet Transporteur d'un dossier) : à terme, le service
// litige y fera ses demandes au service client du transporteur choisi (connexion au compte
// professionnel, réclamation pré-remplie avec la commande et les pièces jointes, suivi de la
// réponse). À finaliser : adresses et comptes de chaque plateforme, puis mise en forme calquée
// sur chacune (voir A-FINALISER-AVEC-IT.md).
export default function CarrierPlatform({ record, canEdit }: CarrierPlatformProps) {
  if (record.origin !== 'Transport') return null;
  const carrier = record.carrier || 'Transporteur non renseigné';
  return (
    <section className="carrier-platform" aria-label={'Plateforme ' + carrier}>
      <div className="carrier-platform-head">
        <span className="carrier-platform-icon">
          <Truck size={18} />
        </span>
        <div>
          <strong>Plateforme {carrier}</strong>
          <small>Demandes au service client du transporteur</small>
        </div>
        <span className="badge pending">Bientôt disponible</span>
      </div>
      <ol>
        <li>Connexion au compte professionnel Cybertek chez {carrier}.</li>
        <li>
          Réclamation pré-remplie : référence {record.ref}, commande {record.order}, pièces jointes
          du dossier.
        </li>
        <li>Suivi de la réponse du transporteur, reporté automatiquement dans ce dossier.</li>
      </ol>
      <button type="button" className="secondary" disabled title="Connexion à finaliser">
        <ExternalLink size={15} />
        {canEdit ? 'Faire une demande sur la plateforme' : 'Réservé au service litige'}
      </button>
    </section>
  );
}
