import { createAuthClient } from "better-auth/react";

// Login e recuperação de senha passam pelo endpoint HTTP do Better Auth
// (/api/auth), onde vale o limite de tentativas configurado em src/lib/auth.ts.
export const authClient = createAuthClient();
