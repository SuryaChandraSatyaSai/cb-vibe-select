import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import dbConnect from "@/lib/db";
import UserModel from "@/models/User";

const allowedDomain = process.env.ALLOWED_ORG_DOMAIN?.toLowerCase();

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      // Single-tenant issuer: only this org's accounts can authenticate.
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
    }),
  ],
  // Login page reads ?error= codes (AccessDenied, Configuration, ...).
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    // ponytail: secondary domain guard; the single-tenant issuer is the primary control.
    signIn({ profile, user }) {
      const email = (profile?.email ?? user?.email ?? "").toLowerCase();
      return !allowedDomain || email.endsWith(`@${allowedDomain}`);
    },
    // On first sign-in, ensure a User row exists and load its role into the token.
    async jwt({ token, user, account }) {
      if (account && user?.email) {
        await dbConnect();
        const dbUser = await UserModel.findOneAndUpdate(
          { email: user.email.toLowerCase() },
          { $set: { name: user.name ?? user.email, lastLogin: new Date() } },
          { new: true, upsert: true } // ponytail: new users default to VIEWER; promote in Mongo
        );
        token.role = dbUser?.role ?? "VIEWER";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) (session.user as { role?: string }).role = (token.role as string) ?? "VIEWER";
      return session;
    },
  },
});
