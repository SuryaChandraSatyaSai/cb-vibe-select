import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import dbConnect from "@/lib/db";
import UserModel from "@/models/User";

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        MicrosoftEntraID({
            clientId: process.env.AZURE_AD_CLIENT_ID,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
            issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
            authorization: {
                params: {
                    scope: "openid profile email User.Read",
                },
            },
        }),
    ],

    secret: process.env.AUTH_SECRET,
    trustHost: true,

    callbacks: {
        async signIn({ user, profile }) {
            const email = user.email;
            console.log(`[Azure AD] Sign-in attempt with email: ${email}, name: ${user.name}`);
            if (!email) return false;

            // Check if domain is allowed (defaults to codebasics.io)
            const allowedDomain = process.env.ALLOWED_ORG_DOMAIN || "codebasics.io";
            if (!email.endsWith(`@${allowedDomain}`)) {
                console.warn(`[Azure AD] Rejected non-org email: ${email}`);
                return false;
            }

            // Get role from Azure AD app roles (set in Azure Portal)
            const azureRoles = (profile as any)?.roles as string[] | undefined;
            const azureRole = azureRoles?.[0] || "VIEWER"; // First assigned role, default VIEWER
            console.log(`[Azure AD] Roles from Azure: ${JSON.stringify(azureRoles)}, using: ${azureRole}`);

            try {
                await dbConnect();

                // Find or create user in database
                let dbUser = await UserModel.findOne({ email });
                if (!dbUser) {
                    dbUser = await UserModel.create({
                        email,
                        name: user.name || email.split("@")[0],
                        role: azureRole as any,
                        isActive: true,
                        lastLogin: new Date(),
                    });
                    console.log(`[Azure AD] Auto-provisioned user: ${email} with role: ${azureRole}`);
                } else {
                    // Sync role from Azure to DB on every login and update login timestamp
                    dbUser.role = azureRole as any;
                    dbUser.lastLogin = new Date();
                    dbUser.name = user.name || dbUser.name;
                    await dbUser.save();
                    console.log(`[Azure AD] Synced role and updated login timestamp for: ${email}`);
                }

                if (!dbUser.isActive) {
                    console.warn(`[Azure AD] Inactive user blocked: ${email}`);
                    return false;
                }

                user.id = dbUser._id.toString();
                (user as any).role = azureRole;
                return true;
            } catch (err) {
                console.error("[Azure AD] Sign-in error in database operation:", err);
                return false;
            }
        },

        async jwt({ token, user }) {
            if (user) {
                token.role = (user as any).role;
                token.id = user.id;
            }
            return token;
        },

        async session({ session, token }) {
            if (session.user) {
                (session.user as any).role = token.role as string;
                (session.user as any).id = token.id as string;
            }
            return session;
        },
    },

    pages: {
        signIn: "/login",
        error: "/login",
    },
});