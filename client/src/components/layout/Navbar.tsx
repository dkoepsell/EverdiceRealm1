import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Loader2, 
  Play, 
  Users, 
  BookOpen, 
  Map, 
  Wrench,
  MoreHorizontal,
  LogOut,
  User,
  Dice5,
  FileCode,
  MessageSquare,
  Shield,
  Menu,
  X,
  Home
} from "lucide-react";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();
  const { user, isLoading, logoutMutation } = useAuth();
  
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  const mainNavLinks = user ? [
    { name: "Play", path: "/dashboard", icon: Play },
    { name: "Characters", path: "/characters", icon: Users },
    { name: "Learn", path: "/learn", icon: BookOpen },
  ] : [];
  
  const moreLinks = [
    { name: "World Map", path: "/world-map", icon: Map },
    { name: "DM Tools", path: "/dm-toolkit", icon: Wrench },
    { name: "Dice Roller", path: "/dice-roller", icon: Dice5 },
    { name: "Find Groups", path: "/bulletin", icon: MessageSquare },
    { name: "CAML", path: "/caml", icon: FileCode },
  ];
  
  const publicLinks = [
    { name: "World", path: "/world-map", icon: Map },
    { name: "About", path: "/how-it-works", icon: BookOpen },
  ];

  const isActive = (path: string) => {
    if (path === "/dashboard" && (location === "/dashboard" || location === "/play")) return true;
    return location === path;
  };

  return (
    <header className="bg-gradient-to-r from-primary to-primary-dark shadow-lg relative z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          <Link href="/">
            <div className="flex items-center space-x-2 cursor-pointer group">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-8 h-8 text-amber-400 group-hover:text-amber-300 transition-colors"
              >
                <path
                  d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 2V22M12 2L19 19.5M12 2L5 19.5M2 12H22M6 7H18M6 17H18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="font-fantasy text-2xl font-bold text-amber-400 group-hover:text-amber-300 transition-colors">
                Everdice
              </span>
            </div>
          </Link>
          
          <nav className="hidden lg:flex items-center space-x-1">
            {mainNavLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link key={link.path} href={link.path}>
                  <Button
                    variant={isActive(link.path) ? "secondary" : "ghost"}
                    className={`${isActive(link.path) 
                      ? 'bg-white/20 text-white' 
                      : 'text-white/90 hover:text-white hover:bg-white/10'
                    } transition-all`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {link.name}
                  </Button>
                </Link>
              );
            })}
            
            {!user && publicLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link key={link.path} href={link.path}>
                  <Button
                    variant={isActive(link.path) ? "secondary" : "ghost"}
                    className={`${isActive(link.path) 
                      ? 'bg-white/20 text-white' 
                      : 'text-white/90 hover:text-white hover:bg-white/10'
                    } transition-all`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {link.name}
                  </Button>
                </Link>
              );
            })}
            
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="text-white/90 hover:text-white hover:bg-white/10">
                    <MoreHorizontal className="h-4 w-4 mr-2" />
                    More
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {moreLinks.map((link) => {
                    const Icon = link.icon;
                    return (
                      <DropdownMenuItem key={link.path} asChild>
                        <Link href={link.path} className="flex items-center cursor-pointer">
                          <Icon className="h-4 w-4 mr-2" />
                          {link.name}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {user?.isAdmin && (
              <Link href="/admin">
                <Button
                  variant="ghost"
                  className="text-amber-300 hover:text-amber-200 hover:bg-white/10"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Admin
                </Button>
              </Link>
            )}
          </nav>
          
          <div className="flex items-center space-x-3">
            <button 
              className="lg:hidden text-white p-2 hover:bg-white/10 rounded-lg transition-colors" 
              onClick={toggleMobileMenu}
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            
            <div className="hidden lg:flex items-center space-x-3">
              {isLoading ? (
                <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
              ) : user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger className="focus:outline-none">
                    <div className="w-10 h-10 rounded-full border-2 border-amber-400 bg-primary-light flex items-center justify-center text-white font-semibold text-lg uppercase hover:border-amber-300 transition-colors cursor-pointer">
                      {user.username.charAt(0)}
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">{user.username}</p>
                        <p className="text-xs text-muted-foreground">Adventurer</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/characters" className="flex items-center cursor-pointer">
                        <User className="h-4 w-4 mr-2" />
                        My Characters
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/campaigns" className="flex items-center cursor-pointer">
                        <Play className="h-4 w-4 mr-2" />
                        My Adventures
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={handleLogout}
                      disabled={logoutMutation.isPending}
                      className="text-red-500 cursor-pointer"
                    >
                      {logoutMutation.isPending ? (
                        <div className="flex items-center">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Logging out...
                        </div>
                      ) : (
                        <>
                          <LogOut className="h-4 w-4 mr-2" />
                          Logout
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link href="/auth">
                  <Button className="bg-amber-500 hover:bg-amber-600 text-white">
                    Get Started
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {mobileMenuOpen && (
        <div className="lg:hidden bg-primary-dark border-t border-white/10">
          <nav className="container mx-auto px-4 py-4 flex flex-col space-y-2">
            {user ? (
              <>
                {mainNavLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link key={link.path} href={link.path}>
                      <Button
                        variant="ghost"
                        className={`w-full justify-start ${isActive(link.path) 
                          ? 'bg-white/20 text-white' 
                          : 'text-white/90 hover:text-white hover:bg-white/10'
                        }`}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Icon className="h-4 w-4 mr-3" />
                        {link.name}
                      </Button>
                    </Link>
                  );
                })}
                
                <div className="border-t border-white/10 my-2 pt-2">
                  <p className="text-xs text-white/50 px-3 py-1">More Options</p>
                </div>
                
                {moreLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link key={link.path} href={link.path}>
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Icon className="h-4 w-4 mr-3" />
                        {link.name}
                      </Button>
                    </Link>
                  );
                })}
                
                <div className="border-t border-white/10 my-2 pt-2">
                  <div className="flex items-center px-3 py-2 space-x-3">
                    <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-white font-semibold uppercase border border-amber-400">
                      {user.username.charAt(0)}
                    </div>
                    <span className="text-white font-medium">{user.username}</span>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-white/10 mt-1"
                    onClick={() => {
                      handleLogout();
                      setMobileMenuOpen(false);
                    }}
                    disabled={logoutMutation.isPending}
                  >
                    <LogOut className="h-4 w-4 mr-3" />
                    {logoutMutation.isPending ? "Logging out..." : "Logout"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                {publicLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link key={link.path} href={link.path}>
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-white/90 hover:text-white hover:bg-white/10"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Icon className="h-4 w-4 mr-3" />
                        {link.name}
                      </Button>
                    </Link>
                  );
                })}
                <Link href="/auth">
                  <Button 
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white mt-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
