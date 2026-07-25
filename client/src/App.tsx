import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { AudioProvider } from "@/hooks/use-audio";
import AudioEventBridge from "@/components/audio/AudioEventBridge";
import { ProtectedRoute } from "./lib/protected-route";
import { createWSConnection } from "./lib/websocket";
import { useBadgeNotifications } from "@/hooks/use-badge-notifications";
import { useEffect, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CoAdminBanner from "@/components/layout/CoAdminBanner";
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
const CommunityPage = lazy(() => import("@/pages/community"));
const AdminPage = lazy(() => import("@/pages/admin"));
const LegalPage = lazy(() => import("@/pages/legal"));
const TavernPage = lazy(() => import("@/pages/tavern"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const HearthPage = lazy(() => import("@/pages/hearth"));
const BeginPage = lazy(() => import("@/pages/begin"));
const DMGuidePage = lazy(() => import("@/pages/dm-guide"));
const TradingPostPage = lazy(() => import("@/pages/trading-post"));
const WanderPage = lazy(() => import("@/pages/wander"));
const DelvePage = lazy(() => import("@/pages/delve"));
const AISettingsPage = lazy(() => import("@/pages/ai-settings"));
const HowItWorks = lazy(() => import("@/pages/how-it-works"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
    </div>
  );
}

// Mounts hooks that need auth context (inside AuthProvider)
function AuthAwareEffects() {
  useBadgeNotifications();
  return null;
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
          backgroundRepeat: 'no-repeat'
          // NOTE: no `backgroundAttachment: 'fixed'` — this element is already position:fixed
          // (pinned to the viewport), so the attachment was redundant AND forced a full-viewport
          // main-thread repaint on every scroll frame (severe jank on high-DPI displays).
        }}
      />
      <CoAdminBanner />
      <Navbar />
      <InvitationAlert />
      <main className="flex-grow relative z-10">
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/" component={LandingPage} />
            <ProtectedRoute path="/dashboard" component={Dashboard} />
            <ProtectedRoute path="/play" component={Dashboard} />
            <ProtectedRoute path="/begin" component={BeginPage} />
            <ProtectedRoute path="/characters" component={Characters} />
            <ProtectedRoute path="/campaigns" component={Campaigns} />
            <ProtectedRoute path="/dice-roller" component={DiceRoller} />
            <ProtectedRoute path="/dm-toolkit" component={DMToolkit} />
            <ProtectedRoute path="/learn" component={LearnPage} />
            <Route path="/world-map" component={WorldMapPage} />
            {/* One Community destination. /bulletin and /groups are kept as
                redirects so existing links and bookmarks still resolve. */}
            <ProtectedRoute path="/community" component={CommunityPage} />
            <Route path="/bulletin"><Redirect to="/community?tab=find-a-game" /></Route>
            <Route path="/groups"><Redirect to="/community?tab=guilds" /></Route>
            <ProtectedRoute path="/tavern" component={TavernPage} />
            <ProtectedRoute path="/hearth" component={HearthPage} />
            <Route path="/trading-post" component={TradingPostPage} />
            <ProtectedRoute path="/wander" component={WanderPage} />
            <ProtectedRoute path="/delve" component={DelvePage} />
            <Route path="/caml" component={CAMLPage} />
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
          <AudioProvider>
            <AuthProvider>
              <AuthAwareEffects />
              <AudioEventBridge />
              <Toaster />
              <Router />
              <FeedbackWidget variant="floating" />
            </AuthProvider>
          </AudioProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
