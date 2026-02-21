import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import { createWSConnection } from "./lib/websocket";
import { useEffect, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import InvitationAlert from "@/components/InvitationAlert";
import parchmentFrame from "@assets/image_1768600727955.png";
import { FeedbackWidget } from "@/components/ui/feedback-widget";

import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import AuthPage from "@/pages/auth-page";

const Dashboard = lazy(() => import("@/pages/dashboard"));
const Characters = lazy(() => import("@/pages/characters"));
const Campaigns = lazy(() => import("@/pages/campaigns"));
const DiceRoller = lazy(() => import("@/pages/dice-roller"));
const DMToolkit = lazy(() => import("@/pages/dm-toolkit"));
const LearnPage = lazy(() => import("@/pages/learn"));
const WorldMapPage = lazy(() => import("@/pages/world-map"));
const CAMLPage = lazy(() => import("@/pages/CAMLPage"));
const BulletinBoardPage = lazy(() => import("@/pages/bulletin-board"));
const AdminPage = lazy(() => import("@/pages/admin"));
const LegalPage = lazy(() => import("@/pages/legal"));
const TavernPage = lazy(() => import("@/pages/tavern"));
const GroupsPage = lazy(() => import("@/pages/groups"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const HearthPage = lazy(() => import("@/pages/hearth"));
const DMGuidePage = lazy(() => import("@/pages/dm-guide"));
const TradingPostPage = lazy(() => import("@/pages/trading-post"));
const WanderPage = lazy(() => import("@/pages/wander"));
const DelvePage = lazy(() => import("@/pages/delve"));
const AISettingsPage = lazy(() => import("@/pages/ai-settings"));
const HowItWorks = lazy(() => import("@/pages/how-it-works"));
const TestPage = lazy(() => import("@/pages/test-page"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
    </div>
  );
}

function Router() {
  return (
    <div className="flex flex-col min-h-screen relative">
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.12] dark:opacity-[0.08]"
        style={{
          backgroundImage: `url(${parchmentFrame})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed'
        }}
      />
      <Navbar />
      <InvitationAlert />
      <main className="flex-grow relative z-10">
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/" component={LandingPage} />
            <ProtectedRoute path="/dashboard" component={Dashboard} />
            <ProtectedRoute path="/play" component={Dashboard} />
            <ProtectedRoute path="/characters" component={Characters} />
            <ProtectedRoute path="/campaigns" component={Campaigns} />
            <ProtectedRoute path="/dice-roller" component={DiceRoller} />
            <ProtectedRoute path="/dm-toolkit" component={DMToolkit} />
            <ProtectedRoute path="/learn" component={LearnPage} />
            <Route path="/world-map" component={WorldMapPage} />
            <ProtectedRoute path="/bulletin" component={BulletinBoardPage} />
            <ProtectedRoute path="/tavern" component={TavernPage} />
            <ProtectedRoute path="/hearth" component={HearthPage} />
            <ProtectedRoute path="/groups" component={GroupsPage} />
            <Route path="/trading-post" component={TradingPostPage} />
            <ProtectedRoute path="/wander" component={WanderPage} />
            <ProtectedRoute path="/delve" component={DelvePage} />
            <Route path="/caml" component={CAMLPage} />
            <ProtectedRoute path="/test" component={TestPage} />
            <ProtectedRoute path="/admin" component={AdminPage} />
            <ProtectedRoute path="/profile" component={ProfilePage} />
            <ProtectedRoute path="/ai-settings" component={AISettingsPage} />
            <Route path="/how-it-works" component={HowItWorks} />
            <Route path="/dm-guide" component={DMGuidePage} />
            <Route path="/legal" component={LegalPage} />
            <Route path="/auth" component={AuthPage} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  useEffect(() => {
    createWSConnection();
    
    const wsHealthCheck = setInterval(() => {
      createWSConnection();
    }, 30000);
    
    const handleOnline = () => {
      createWSConnection(true);
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
            <FeedbackWidget variant="floating" />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
