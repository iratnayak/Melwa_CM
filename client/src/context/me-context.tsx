"use client";

import { createContext, useContext, type ReactNode } from "react";

export type MeUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

const MeContext = createContext<MeUser | null>(null);

export function MeProvider({ me, children }: { me: MeUser; children: ReactNode }) {
  return <MeContext.Provider value={me}>{children}</MeContext.Provider>;
}

export function useMe(): MeUser {
  const me = useContext(MeContext);
  if (!me) {
    throw new Error("useMe must be used within MeProvider");
  }
  return me;
}

export function useIsAdmin(): boolean {
  return useMe().role === "admin";
}
