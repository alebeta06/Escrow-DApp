"use client";

import { Contract, type Result } from "ethers";
import { ESCROW_ABI } from "@/lib/abis";
import { ESCROW_ADDRESS } from "@/lib/contracts";
import { toOperation, type Operation } from "@/types/operation";
import { useChainRead, type ChainRead } from "@/hooks/useChainRead";

/** Reads `getAllOperations()` and maps each raw tuple to a typed {@link Operation}. */
export function useOperations(): ChainRead<Operation[]> {
  return useChainRead<Operation[]>(async (provider) => {
    const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, provider);
    const raw = (await escrow.getAllOperations()) as Result[];
    return raw.map((entry) => toOperation(entry));
  });
}
