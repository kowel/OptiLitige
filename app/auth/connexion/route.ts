// Connexion : en ligne, redirection vers Microsoft (Entra ID) par Supabase Auth ; en local,
// connexion simulée (cookie) pour le serveur de développement et les tests.
import { NextResponse } from 'next/server';
import { requestOrigin, safeReturnPath } from '../../server/origin';
import { LOCAL_COOKIE, LOCAL_USER, authMode, supabaseAuthClient } from '../../auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = requestOrigin(req);
  // Retour seulement vers une page de l'outil (jamais vers un autre site)
  const back = safeReturnPath(url.searchParams.get('return_to'), origin);
  if (authMode() === 'local') {
    const res = NextResponse.redirect(new URL(back, origin));
    const email = url.searchParams.get('email') || LOCAL_USER.email;
    res.cookies.set(LOCAL_COOKIE, email.toLowerCase(), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
    return res;
  }
  const supabase = await supabaseAuthClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      scopes: 'email',
      redirectTo: origin + '/auth/callback?return_to=' + encodeURIComponent(back),
    },
  });
  if (error || !data.url)
    return new Response('Connexion Microsoft indisponible : ' + (error?.message || ''), {
      status: 503,
    });
  return NextResponse.redirect(data.url);
}
