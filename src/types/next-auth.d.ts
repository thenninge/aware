import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    accessToken?: string
    user: {
      googleId?: string
      email: string
      name?: string
      image?: string
      nickname?: string
    }
  }

  interface User {
    googleId?: string
    nickname?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
    googleId?: string
  }
}

