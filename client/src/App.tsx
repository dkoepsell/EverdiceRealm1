import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import { createWSConnection } from "./lib/websocket";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Characters from "@/pages/characters";
import Campaigns from "@/pages/campaigns";
import DiceRoller from "@/pages/dice-roller";
import AuthPage from "@/pages/auth-page";
import TestPage from "@/pages/test-page";
import HowItWorks from "@/pages/how-it-works";
import DMToolkit from "@/pages/dm-toolkit";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

function Router() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
        <Switch>
          <ProtectedRoute path="/" component={Dashboard} />
          <ProtectedRoute path="/characters" component={Characters} />
          <ProtectedRoute path="/campaigns" component={Campaigns} />
          <ProtectedRoute path="/dice-roller" component={DiceRoller} />
          <ProtectedRoute path="/dm-toolkit" component={DMToolkit} />
          <ProtectedRoute path="/test" component={TestPage} />
          <Route path="/how-it-works" component={HowItWorks} />
          <Route path="/auth" component={AuthPage} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  // Initialize WebSocket connection
  useEffect(() => {
    // Initialize WebSocket connection when app loads
    console.log("Initializing WebSocket connection...");
    createWSConnection();
    
    // Set up a periodic check to ensure WebSocket stays connected
    const wsHealthCheck = setInterval(() => {
      createWSConnection(); // This will only connect if not already connected
    }, 30000); // Check every 30 seconds
    
    // Listen for online/offline events to reconnect when network is restored
    const handleOnline = () => {
      console.log("Network online, attempting to reconnect WebSocket");
      createWSConnection(true); // Force reconnection
    };
    
    window.addEventListener('online', handleOnline);
    
    return () => {
      clearInterval(wsHealthCheck);
      window.removeEventListener('online', handleOnline);
    };
  }, []);
  
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark">
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <Router />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
