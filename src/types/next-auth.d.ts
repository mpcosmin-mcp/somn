/* Module augmentation: carry our stable user id (Google `sub`) on the
   session + JWT so server code can read `session.user.id`. */
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
    } & import('next-auth').DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid?: string;
  }
}
