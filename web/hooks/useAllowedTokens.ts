"use client";

import { Contract } from "ethers";
import { ERC20_ABI, ESCROW_ABI } from "@/lib/abis";
import { ESCROW_ADDRESS } from "@/lib/contracts";
import { useChainRead, type ChainRead } from "@/hooks/useChainRead";

export interface AllowedToken {
  address: string;
  symbol: string;
  decimals: number;
}

/**
 * Reads the escrow allowlist and enriches each token with its `symbol` and `decimals`
 * (both read in parallel per token). Used by AddToken, CreateOperation and BalanceDebug.
 */
export function useAllowedTokens(): ChainRead<AllowedToken[]> {
  return useChainRead<AllowedToken[]>(async (provider) => {
    const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, provider);
    const addresses = (await escrow.getAllowedTokens()) as string[];
    return Promise.all(
      addresses.map(async (address) => {
        const erc20 = new Contract(address, ERC20_ABI, provider);
        const [symbol, decimals] = await Promise.all([erc20.symbol(), erc20.decimals()]);
        return { address, symbol: symbol as string, decimals: Number(decimals) };
      }),
    );
  });
}
