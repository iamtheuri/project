// @ts-nocheck
import { useState, useEffect } from "react";
import { getWeb3AuthInstance } from "@/lib/web3auth";

interface AuthStatus {
  isLoggedIn: boolean;
  userEmail: string | null;
  userName: string | null;
  provider: any | null;
  isLoading: boolean;
}

/**
 * Custom hook to track authentication status across the application
 * @param debugMode - Whether to log authentication state changes to console
 * @returns AuthStatus object containing login state and user information
 */
export function useAuthStatus(debugMode = false): AuthStatus {
  const [authState, setAuthState] = useState<AuthStatus>({
    isLoggedIn: false,
    userEmail: null,
    userName: null,
    provider: null,
    isLoading: true,
  });

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // Check localStorage first (faster than Web3Auth checks)
        const localIsLoggedIn = localStorage.getItem("isLoggedIn") === "true";
        const localUserEmail = localStorage.getItem("userEmail");

        // Get the Web3Auth instance
        const web3auth = getWeb3AuthInstance();

        // Check Web3Auth connection status
        let web3AuthConnected = false;
        let web3AuthUser = null;
        let web3AuthProvider = null;

        if (web3auth && web3auth.connected) {
          web3AuthConnected = true;

          try {
            web3AuthUser = await web3auth.getUserInfo();
            web3AuthProvider = web3auth.provider;
          } catch (error) {
            console.error("Error getting Web3Auth user info:", error);
          }
        }

        // Determine final auth state (Web3Auth takes precedence over localStorage)
        const isLoggedIn = web3AuthConnected || localIsLoggedIn;
        const userEmail = web3AuthUser?.email || localUserEmail || null;
        const userName = web3AuthUser?.name || null;

        const newAuthState = {
          isLoggedIn,
          userEmail,
          userName,
          provider: web3AuthProvider,
          isLoading: false,
        };

        setAuthState(newAuthState);

        // Log state changes if debug mode is enabled
        if (debugMode) {
          console.log("[useAuthStatus] Auth state:", {
            isLoggedIn,
            userEmail: userEmail ? `${userEmail.substring(0, 3)}...` : null, // Mask email for privacy in logs
            hasProvider: !!web3AuthProvider,
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
    };

    checkAuthStatus();

    const useAuthStatus = (checkAuthStatus) => {
      useEffect(() => {
        checkAuthStatus();
      }, [checkAuthStatus]);
    };
  }, [debugMode]);

  return authState;
}
