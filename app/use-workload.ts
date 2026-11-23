'use client';
import { useMemo } from 'react';
import { groupNotifications } from './notifications.mjs';
import { buildAlerts } from './alerts.mjs';
import { buildMyDay } from './my-day.mjs';
import { watchedIds } from './watch.mjs';
import { customerIndex } from './repeat-customer.mjs';
import type { AlertItem, Dossier, Member, SlaRule } from './types';

// Calculs faits sur tous les dossiers (notifications, « Ma journée », index des clients) :
// refaits seulement quand les données changent, pas à chaque frappe dans un champ.
export function useWorkload({
  records,
  me,
  role,
  rules,
  slaNow,
  mentionReads,
  alertReads,
  watchList,
  reminders,
  reports,
}: {
  records: Dossier[];
  me: Member;
  role: string;
  rules: SlaRule[];
  slaNow: number;
  mentionReads: string[];
  alertReads: string[];
  watchList: { id: string; since: string }[];
  reminders: object[];
  reports: object[];
}) {
  const alerts = useMemo(
    () => groupNotifications(records, me, mentionReads),
    [records, me, mentionReads],
  );
  const categoryAlerts = useMemo(
    () =>
      buildAlerts(
        records,
        { ...me, role },
        { rules, readKeys: alertReads, now: slaNow, watching: watchList, reminders, reports },
      ) as Record<string, AlertItem[]>,
    [records, me, role, rules, alertReads, slaNow, watchList, reminders, reports],
  );
  const myDay = useMemo(
    () =>
      buildMyDay(
        records,
        { ...me, role },
        // slaNow vaut 0 avant l'affichage dans le navigateur : l'heure est alors lue par buildMyDay
        { rules, now: slaNow || undefined, alerts: categoryAlerts, mentions: alerts },
      ),
    [records, me, role, rules, slaNow, categoryAlerts, alerts],
  );
  const watching = useMemo(() => watchedIds(watchList) as string[], [watchList]);
  const customers = useMemo(() => customerIndex(records), [records]);
  return { alerts, categoryAlerts, myDay, watching, customers };
}
