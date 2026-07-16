"use client";

import { Contract } from "ethers";
import { ERC20_ABI, ESCROW_ABI } from "@/lib/abis";
import { ESCROW_ADDRESS } from "@/lib/contracts";
import { useEthereum } from "@/lib/ethereum";
import { useChainRead, type ChainRead } from "@/hooks/useChainRead";
import type { AllowedToken } from "@/hooks/useAllowedTokens";

export interface TokenBalance {
  address: string;
  symbol: string;
  decimals: number;
  balance: bigint;
}
export interface AccountBalances {
  label: string;
  address: string;
  eth: bigint;
  tokens: TokenBalance[];
}
export interface BalancesData {
  tokens: AllowedToken[];
  accounts: AccountBalances[];
}

/**
 * Reads ETH + each allowlisted token balance for the escrow and the connected wallet.
 * Every account row and every token balance is fetched in parallel.
 *
 * 🇪🇸 NOTA: antes mostraba 3 cuentas Anvil hardcodeadas (#0/#1/#2); en redes reales (Sepolia) esas
 *    direcciones no significan nada. Ahora: el Escrow + la cuenta conectada. El loader captura
 *    `account`; como cada cambio de cuenta crea un nuevo `BrowserProvider` en `useEthereum`,
 *    `useChainRead` refetcha por cambio de identidad del `provider` (no hace falta tocar sus deps).
 */
export function useBalances(): ChainRead<BalancesData> {
  const { account } = useEthereum();
  return useChainRead<BalancesData>(async (provider) => {
    const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, provider);
    const tokenAddresses = (await escrow.getAllowedTokens()) as string[];

    const tokens: AllowedToken[] = await Promise.all(
      tokenAddresses.map(async (address) => {
        const erc20 = new Contract(address, ERC20_ABI, provider);
        const [symbol, decimals] = await Promise.all([erc20.symbol(), erc20.decimals()]);
        return { address, symbol: symbol as string, decimals: Number(decimals) };
      }),
    );

    // 🇪🇸 Escrow siempre (fila destacada, index 0); la wallet conectada solo si hay cuenta.
    const rows: ReadonlyArray<{ label: string; address: string }> = [
      { label: "Escrow (contract)", address: ESCROW_ADDRESS },
      ...(account ? [{ label: "Your wallet", address: account }] : []),
    ];

    const accounts: AccountBalances[] = await Promise.all(
      rows.map(async ({ label, address }) => {
        const [eth, tokenBalances] = await Promise.all([
          provider.getBalance(address),
          Promise.all(
            tokens.map(async (token) => {
              const erc20 = new Contract(token.address, ERC20_ABI, provider);
              const balance = (await erc20.balanceOf(address)) as bigint;
              return { ...token, balance };
            }),
          ),
        ]);
        return { label, address, eth, tokens: tokenBalances };
      }),
    );

    return { tokens, accounts };
  });
}
