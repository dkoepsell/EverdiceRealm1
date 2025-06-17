import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User as SelectUser, insertUserSchema } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, RegisterData>;
};

// Create more specific schemas for login and registration
const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = insertUserSchema.pick({
  username: true,
  password: true,
}).extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

type LoginData = z.infer<typeof loginSchema>;
type RegisterData = z.infer<typeof registerSchema>;

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
    refetch: refetchUser
  } = useQuery<SelectUser | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: 1,
    retryDelay: 1000,
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: true, // Refresh user data when tab regains focus
    refetchOnReconnect: true, // Refresh when network reconnects
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Login failed");
      }
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      // Update the user data in the cache
      queryClient.setQueryData(["/api/user"], user);
      
      // Invalidate relevant queries to ensure fresh data after login
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dice/history'] });
      
      // Create WebSocket connection after login
      try {
        import('../lib/websocket').then(wsModule => {
          if (wsModule && wsModule.createWSConnection) {
            wsModule.createWSConnection(true);
          }
        }).catch(err => {
          console.error('Failed to initialize WebSocket after login:', err);
        });
      } catch (err) {
        console.error('Failed to initialize WebSocket after login:', err);
      }
      
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterData) => {
      // Remove confirmPassword before sending to API
      const { confirmPassword, ...userData } = credentials;
      
      const res = await apiRequest("POST", "/api/register", userData);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Registration failed");
      }
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      // Update the user data in the cache
      queryClient.setQueryData(["/api/user"], user);
      
      // Invalidate relevant queries to ensure fresh data after registration
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      
      // Create WebSocket connection after registration
      try {
        import('../lib/websocket').then(wsModule => {
          if (wsModule && wsModule.createWSConnection) {
            wsModule.createWSConnection(true);
          }
        }).catch(err => {
          console.error('Failed to initialize WebSocket after registration:', err);
        });
      } catch (err) {
        console.error('Failed to initialize WebSocket after registration:', err);
      }
      
      toast({
        title: "Registration successful",
        description: `Welcome, ${user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/logout");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Logout failed");
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}