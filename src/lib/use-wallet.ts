"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  lastWalletChoice,
  rememberWalletChoice,
  resolveWalletProvider,
  startWalletDiscovery,
  type WalletOption,
} from "./wallet-session";
import type { Eip1193Provider } from "./wallet";

export type WalletRunner = {
  options: WalletOption[];
  picking: boolean;
  run: (action: (provider: Eip1193Provider) => Promise<void>) => Promise<void>;
  choose: (id: string) => void;
  cancel: () => void;
};

type PendingAction = {
  action: (provider: Eip1193Provider) => Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
};

export const useWallet = (): WalletRunner => {
  const [options, setOptions] = useState<WalletOption[]>([]);
  const [picking, setPicking] = useState(false);
  const providerRef = useRef<Eip1193Provider | undefined>(undefined);
  const pendingRef = useRef<PendingAction | undefined>(undefined);

  useEffect(() => startWalletDiscovery(setOptions), []);

  const run = useCallback(
    async (action: (provider: Eip1193Provider) => Promise<void>) => {
      if (providerRef.current) return action(providerRef.current);
      const remembered = lastWalletChoice();
      if (remembered) {
        const provider = await resolveWalletProvider(remembered);
        providerRef.current = provider;
        return action(provider);
      }
      if (options.length === 1) {
        const provider = await resolveWalletProvider(options[0].id);
        providerRef.current = provider;
        return action(provider);
      }
      return new Promise<void>((resolve, reject) => {
        pendingRef.current = { action, resolve, reject };
        setPicking(true);
      });
    },
    [options],
  );

  const choose = useCallback((id: string) => {
    const pending = pendingRef.current;
    pendingRef.current = undefined;
    void (async () => {
      try {
        const provider = await resolveWalletProvider(id);
        providerRef.current = provider;
        rememberWalletChoice(id);
        setPicking(false);
        if (pending) {
          await pending.action(provider);
          pending.resolve();
        }
      } catch (error) {
        setPicking(false);
        pending?.reject(error);
      }
    })();
  }, []);

  const cancel = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = undefined;
    setPicking(false);
    pending?.resolve();
  }, []);

  return { options, picking, run, choose, cancel };
};
