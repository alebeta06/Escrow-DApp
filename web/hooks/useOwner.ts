"use client";

import { Contract } from "ethers";
import { ESCROW_ABI } from "@/lib/abis";
import { ESCROW_ADDRESS } from "@/lib/contracts";
import { useChainRead, type ChainRead } from "@/hooks/useChainRead";

/** Reads `escrow.owner()` — used to gate the owner-only AddToken panel. */
export function useOwner(): ChainRead<string> {
  return useChainRead<string>(async (provider) => {
    const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, provider);
    return (await escrow.owner()) as string;
  });
}
