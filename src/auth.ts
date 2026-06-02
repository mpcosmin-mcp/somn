/* ─────────────────────────────────────────────────────────
   Auth.js (NextAuth v5) — Google-only sign-in.

   ROADMAP Phase 0: each person signs in with their own Google
   account → a unique, stable user id (the Google `sub`). Writes
   are keyed on the *server-side session* id, so nobody can log
   on anyone else's behalf.

   Sessions are JWT (cookie-based) → users stay logged in.
   Profile is upserted into Neon on sign-in (best-effort; guarded
   so the app still works before DATABASE_URL is wired).

   Env (Auth.js v5 convention):
     AUTH_SECRET         — random secret for JWT signing
     AUTH_GOOGLE_ID      — Google OAuth client id
     AUTH_GOOGLE_SECRET  — Google OAuth client secret
   ───────────────────────────────────────────────────────── */
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { dbAvailable } from '@/lib/db/client';
import { upsertUser } from '@/lib/db/repo';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  session: { strategy: 'jwt' },
  callbacks: {
    // Stamp the stable Google `sub` onto the JWT as our user id.
    async jwt({ token, profile }) {
      if (profile?.sub) token.uid = profile.sub;
      return token;
    },
    // Expose the id on the session so server code can key writes on it.
    async session({ session, token }) {
      if (token.uid && session.user) {
        session.user.id = token.uid as string;
      }
      return session;
    },
    // Persist / refresh the user profile in Neon on every sign-in.
    async signIn({ user, profile }) {
      if (!dbAvailable() || !profile?.sub) return true;
      try {
        const name = profile.name ?? user.name ?? 'Sleeper';
        await upsertUser({
          id: profile.sub,
          email: profile.email ?? user.email ?? '',
          displayName: name,
          firstName: (profile.given_name as string | undefined) ?? name.split(' ')[0],
          avatarUrl: profile.picture ?? user.image ?? null,
        });
      } catch (err) {
        // Don't block login if the DB write fails — log and continue.
        console.error('[auth] upsertUser failed', err);
      }
      return true;
    },
  },
});
