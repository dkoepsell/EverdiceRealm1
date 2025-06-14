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
import { Loader2 } from "lucide-react";

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
  
  const navLinks = [
    { name: "Dashboard", path: "/" },
    { name: "Characters", path: "/characters" },
    { name: "Campaigns", path: "/campaigns" },
    { name: "Dice Roller", path: "/dice-roller" },
    { name: "DM Toolkit", path: "/dm-toolkit" },
  ];
  
  // This link doesn't require authentication
  const publicLinks = [
    { name: "How It Works", path: "/how-it-works" },
  ];

  return (
    <header className="bg-primary shadow-lg relative z-10">
      <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            {/* App Logo */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8 text-gold"
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
            <h1 className="font-fantasy text-2xl font-bold text-gold">Everdice</h1>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-6">
            {user && navLinks.map((link) => (
              <Link key={link.path} href={link.path}>
                <span className={`${location === link.path ? 'text-gold' : 'text-white hover:text-gold'} transition font-medium cursor-pointer`}>
                  {link.name}
                </span>
              </Link>
            ))}
            {publicLinks.map((link) => (
              <Link key={link.path} href={link.path}>
                <span className={`${location === link.path ? 'text-gold' : 'text-white hover:text-gold'} transition font-medium cursor-pointer`}>
                  {link.name}
                </span>
              </Link>
            ))}
          </nav>
          
          {/* Mobile Menu Button */}
          <button 
            className="md:hidden text-white focus:outline-none" 
            onClick={toggleMobileMenu}
            aria-label="Toggle mobile menu"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-6 w-6" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 6h16M4 12h16M4 18h16" 
              />
            </svg>
          </button>
          
          {/* User Profile */}
          <div className="hidden md:flex items-center space-x-3">
            {isLoading ? (
              <Loader2 className="w-8 h-8 text-gold animate-spin" />
            ) : user ? (
              <>
                <Link href="/campaigns">
                  <Button className="bg-primary-light hover:bg-primary-dark text-white px-4 py-2 rounded-lg transition">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4 mr-2"
                    >
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    New Game
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger className="focus:outline-none">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full border-2 border-gold bg-indigo-700 flex items-center justify-center text-white font-semibold text-lg uppercase">
                        {user.username.charAt(0)}
                      </div>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>
                      {user.username}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/characters">My Characters</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/campaigns">My Campaigns</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dm-toolkit">DM Toolkit</Link>
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
                      ) : "Logout"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Link href="/auth">
                <Button>Login</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile Navigation Dropdown */}
      <div 
        className={`md:hidden ${mobileMenuOpen ? 'block' : 'hidden'} bg-primary-dark absolute w-full py-2 shadow-xl`}
      >
        <nav className="container mx-auto px-4 flex flex-col space-y-3">
          {user && navLinks.map((link) => (
            <Link key={link.path} href={link.path}>
              <span 
                className={`${location === link.path ? 'text-gold' : 'text-white hover:text-gold'} transition font-medium py-2 block cursor-pointer`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.name}
              </span>
            </Link>
          ))}
          
          {publicLinks.map((link) => (
            <Link key={link.path} href={link.path}>
              <span 
                className={`${location === link.path ? 'text-gold' : 'text-white hover:text-gold'} transition font-medium py-2 block cursor-pointer`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.name}
              </span>
            </Link>
          ))}
          
          {user && (
            <Link href="/campaigns">
              <span 
                className="bg-primary-light hover:bg-primary-dark text-white px-4 py-2 rounded-lg transition text-left block cursor-pointer"
                onClick={() => setMobileMenuOpen(false)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4 inline mr-2"
                >
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                New Game
              </span>
            </Link>
          )}
          
          {isLoading ? (
            <div className="flex justify-center py-2">
              <Loader2 className="text-gold w-6 h-6 animate-spin" />
            </div>
          ) : user ? (
            <button 
              onClick={() => {
                handleLogout();
                setMobileMenuOpen(false);
              }}
              disabled={logoutMutation.isPending}
              className="text-white hover:text-red-400 py-2 font-medium transition text-left"
            >
              {logoutMutation.isPending ? (
                <div className="flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging out...
                </div>
              ) : "Logout"}
            </button>
          ) : (
            <Link href="/auth">
              <span 
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition text-center font-medium block cursor-pointer"
                onClick={() => setMobileMenuOpen(false)}
              >
                Login
              </span>
            </Link>
          )}
          
          {/* User info if logged in */}
          {user && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-indigo-700 flex items-center justify-center text-white font-semibold text-lg uppercase">
                  {user.username.charAt(0)}
                </div>
                <div>
                  <p className="text-white font-medium">{user.username}</p>
                </div>
              </div>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
