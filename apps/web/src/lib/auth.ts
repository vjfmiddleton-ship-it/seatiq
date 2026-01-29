import { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

// Always use console logging for magic links (no email server configured for development)
const sendVerificationRequest = async ({ identifier, url }: { identifier: string; url: string }) => {
  console.log("\n");
  console.log("========================================");
  console.log("MAGIC LINK LOGIN");
  console.log("========================================");
  console.log(`Email: ${identifier}`);
  console.log(`URL: ${url}`);
  console.log("========================================");
  console.log("\n");
};

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER || "smtp://localhost:1025",
      from: process.env.EMAIL_FROM || "noreply@seatiq.app",
      sendVerificationRequest,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify-request",
    error: "/auth/error",
  },
};
