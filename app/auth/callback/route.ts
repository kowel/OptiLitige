// Retour de Microsoft après la connexion : Supabase échange le code contre la session (cookies).
import { NextResponse } from 'next/server';
import { requestOrigin, safeReturnPath } from '../../server/origin';
import { supabaseAuthClient } from '../../auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const origin = requestOrigin(req);
  const path = safeReturnPath(url.searchParams.get('return_to'), origin);
  // Connexion refusée ou annulée côté Microsoft : message clair plutôt qu'un retour silencieux
  const refused = url.searchParams.get('error_description') || url.searchParams.get('error');
  if (refused && !code)
    return new Response('Connexion refusée : ' + refused.slice(0, 300), {
      status: 401,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  if (code) {
    const supabase = await supabaseAuthClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error)
      return new Response('Connexion refusée : ' + error.message, {
        status: 401,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
  }
  return NextResponse.redirect(new URL(path, origin));
}
