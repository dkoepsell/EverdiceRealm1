import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="bg-primary-dark text-white py-4 sm:py-8">
      <div className="container mx-auto px-2 sm:px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
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
              <h2 className="font-fantasy text-xl font-bold text-gold">Everdice</h2>
            </div>
            <p className="text-gray-300 mb-4">
              Your AI-powered companion for tabletop roleplaying adventures. Create characters, roll dice, and embark on epic quests.
            </p>
          </div>
          
          <div>
            <h3 className="font-fantasy text-lg font-bold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><Link href="/" className="text-gray-300 hover:text-gold transition">Home</Link></li>
              <li><Link href="/characters" className="text-gray-300 hover:text-gold transition">Characters</Link></li>
              <li><Link href="/campaigns" className="text-gray-300 hover:text-gold transition">Campaigns</Link></li>
              <li><Link href="/dice-roller" className="text-gray-300 hover:text-gold transition">Dice Roller</Link></li>
              <li><Link href="/how-it-works" className="text-gray-300 hover:text-gold transition">How It Works</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-fantasy text-lg font-bold mb-4">Connect</h3>
            <div className="flex space-x-4 mb-4">
              <a href="https://github.com/dkoepsell" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-gold transition text-xl">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                </svg>
              </a>
              <a href="https://github.com/dkoepsell/Everdice" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-gold transition text-xl">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
              </a>
            </div>
            <div className="mb-4">
              <a href="https://github.com/dkoepsell" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-gold transition">
                <span className="font-semibold">Created by</span>: dkoepsell
              </a>
            </div>
            <p className="text-gray-400 text-sm">© 2025 Everdice. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
