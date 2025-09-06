import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Persist the OAuth access_token and or the user id to the token right after signin
      if (account) {
        token.accessToken = account.access_token
        token.googleId = profile?.sub
      }
      return token
    },
    async session({ session, token }) {
      // Send properties to the client, like an access_token and user id from a provider.
      session.accessToken = token.accessToken
      if (session.user) {
        session.user.googleId = token.googleId
      }
      return session
    },
  },
  pages: {
    signIn: '/', // Redirect to home page after sign in
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
