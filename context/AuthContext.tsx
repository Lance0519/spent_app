import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { FinanceService } from '../services/FinanceService';

interface AuthContextType {
  isLocked: boolean;
  isLoggedIn: boolean;
  authChecked: boolean;
  lockApp: () => void;
  unlockApp: () => Promise<boolean>;
  exitSession: () => void;
  loginUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isLocked: false,
  isLoggedIn: true,
  authChecked: false,
  lockApp: () => {},
  unlockApp: async () => false,
  exitSession: () => {},
  loginUser: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const [isLocked, setIsLocked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const appState = useRef(AppState.currentState);

  const checkInitialAuth = useCallback(async () => {
    try {
      const status = FinanceService.getSessionStatus();
      setIsLoggedIn(status.isLoggedIn);

      const profile = FinanceService.getUserProfile();
      if (profile.biometrics_enabled === 1 && status.isLoggedIn) {
        setIsLocked(true);
        // Attempt automatic biometric prompt on startup
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (hasHardware && isEnrolled) {
          const res = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Authenticate to open SPENT',
            fallbackLabel: 'Use Passcode',
          });
          if (res.success) {
            setIsLocked(false);
          }
        } else {
          setIsLocked(false);
        }
      } else {
        setIsLocked(false);
      }
    } catch {
      setIsLocked(false);
    } finally {
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    checkInitialAuth();
  }, [checkInitialAuth]);

  // Listen to AppState transitions (background -> active re-lock)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        try {
          const profile = FinanceService.getUserProfile();
          const status = FinanceService.getSessionStatus();
          if (profile.biometrics_enabled === 1 && status.isLoggedIn) {
            setIsLocked(true);
            const res = await LocalAuthentication.authenticateAsync({
              promptMessage: 'Authenticate to resume SPENT',
              fallbackLabel: 'Use Passcode',
            });
            if (res.success) {
              setIsLocked(false);
            }
          }
        } catch {
          // Keep current lock state
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const lockApp = useCallback(() => {
    setIsLocked(true);
  }, []);

  const unlockApp = useCallback(async (): Promise<boolean> => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        const res = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to unlock SPENT',
          fallbackLabel: 'Use Passcode',
        });
        if (res.success) {
          setIsLocked(false);
          return true;
        }
        return false;
      }
      setIsLocked(false);
      return true;
    } catch {
      return false;
    }
  }, []);

  const loginUser = useCallback(() => {
    FinanceService.startUserSession();
    setIsLoggedIn(true);
    setIsLocked(false);
  }, []);

  const exitSession = useCallback(() => {
    Alert.alert(
      'Exit Session',
      'Are you sure you want to exit your session? You will need to log in again to access your financial data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            FinanceService.terminateUserSession();
            setIsLoggedIn(false);
            setIsLocked(false);
            router.replace('/');
          },
        },
      ]
    );
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        isLocked,
        isLoggedIn,
        authChecked,
        lockApp,
        unlockApp,
        exitSession,
        loginUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
