// Déconnexion (bouton, ou automatique après 2 h sans action) : fin de la session Supabase,
// ou du cookie de la connexion simulée en local.
import { NextResponse } from 'next/server';
import { requestOrigin } from '../../server/origin';
import { LOCAL_COOKIE, authMode, supabaseAuthClient } from '../../auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL('/', requestOrigin(req)));
  if (authMode() === 'local') res.cookies.delete(LOCAL_COOKIE);
  // Ce poste seulement : la déconnexion automatique d'un PC partagé ne ferme pas les autres sessions
  else await (await supabaseAuthClient()).auth.signOut({ scope: 'local' });
  return res;
}
