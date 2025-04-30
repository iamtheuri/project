// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { getWeb3AuthInstance } from "@/lib/web3auth";

interface AuthStatus {
  isLoggedIn: boolean;
  userEmail: string | null;
  userName: string | null;
  provider: any | null;
  isLoading: boolean;
}

export function useAuthStatus(
  debugMode = false
): AuthStatus & { refreshStatus: () => void } {
  const [authState, setAuthState] = useState<AuthStatus>({
    isLoggedIn: false,
    userEmail: null,
    userName: null,
    provider: null,
    isLoading: true,
  });
  const [refreshCounter, setRefreshCounter] = useState(0);

  const refreshStatus = useCallback(() => {
    setRefreshCounter((prev) => prev + 1);
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      const localIsLoggedIn = localStorage.getItem("isLoggedIn") === "true";
      const localUserEmail = localStorage.getItem("userEmail");
      const web3auth = getWeb3AuthInstance();

      let web3AuthConnected = false;
      let web3AuthUser = null;
      let web3AuthProvider = null;

      if (web3auth?.connected) {
        web3AuthConnected = true;
        try {
          web3AuthUser = await web3auth.getUserInfo();
          web3AuthProvider = web3auth.provider;
        } catch (error) {
          console.error("Error getting Web3Auth user info:", error);
        }
      }

      const isLoggedIn = web3AuthConnected || localIsLoggedIn;
      const userEmail = web3AuthUser?.email || localUserEmail || null;
      const userName = web3AuthUser?.name || null;

      setAuthState({
        isLoggedIn,
        userEmail,
        userName,
        provider: web3AuthProvider,
        isLoading: false,
      });

      if (debugMode) {
        console.log("[useAuthStatus] Auth state updated:", {
          isLoggedIn,
          userEmail: userEmail ? `${userEmail.substring(0, 3)}...` : null,
          source: web3AuthConnected
            ? "Web3Auth"
            : localIsLoggedIn
            ? "localStorage"
            : "none",
        });
      }
    } catch (error) {
      console.error("[useAuthStatus] Error checking auth status:", error);
      setAuthState({
        isLoggedIn: false,
        userEmail: null,
        userName: null,
        provider: null,
        isLoading: false,
      });
    }
  }, [debugMode]);

  useEffect(() => {
    checkAuthStatus();

    const web3auth = getWeb3AuthInstance();
    const onAuthChange = () => {
      if (debugMode) console.log("[useAuthStatus] Auth change detected");
      checkAuthStatus();
    };

    // Setup event listeners
    if (web3auth) {
      web3auth.on("connected", onAuthChange);
      web3auth.on("disconnected", onAuthChange);
    }

    const storageListener = (e: StorageEvent) => {
      if (e.key === "isLoggedIn" || e.key === "userEmail") {
        onAuthChange();
      }
    };
    window.addEventListener("storage", storageListener);

    return () => {
      if (web3auth) {
        web3auth.off("connected", onAuthChange);
        web3auth.off("disconnected", onAuthChange);
      }
      window.removeEventListener("storage", storageListener);
    };
  }, [checkAuthStatus, debugMode, refreshCounter]);

  return { ...authState, refreshStatus };
}
