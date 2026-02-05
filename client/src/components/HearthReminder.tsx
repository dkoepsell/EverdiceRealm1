import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { X, Flame, MessageSquare, Users, Sparkles, Store, BookOpen, Gem, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

const REMINDER_INTERVAL_MS = 120 * 60 * 1000;
const LAST_SHOWN_KEY = 'hearth_reminder_last_shown';
const LAST_POPUP_INDEX_KEY = 'hearth_reminder_last_index';

interface PopupConfig {
  icon: LucideIcon;
  iconColor: string;
  gradient: string;
  borderColor: string;
  accentBar: string;
  title: string;
  titleIcon: LucideIcon;
  description: string;
  tags: { icon: LucideIcon; label: string }[];
  actionLabel: string;
  actionIcon: LucideIcon;
  actionHref: string;
  buttonClass: string;
  dismissClass: string;
  dismissTextClass: string;
}

const POPUPS: PopupConfig[] = [
  {
    icon: Flame,
    iconColor: 'text-amber-400',
    gradient: 'from-amber-900 via-orange-900 to-red-900',
    borderColor: 'border-amber-500/50',
    accentBar: 'from-amber-500 via-orange-500 to-red-500',
    title: 'Visit the Hearth',
    titleIcon: Sparkles,
    description: 'Take a break at the Hearth! Chat with fellow adventurers, leave notes, and relax by the fire.',
    tags: [
      { icon: Users, label: 'Community' },
      { icon: MessageSquare, label: 'Notes' },
    ],
    actionLabel: 'Enter the Hearth',
    actionIcon: Flame,
    actionHref: '/hearth',
    buttonClass: 'bg-amber-600 hover:bg-amber-500 text-white',
    dismissClass: 'text-amber-300 hover:text-amber-100 hover:bg-amber-800/50',
    dismissTextClass: 'text-amber-300/70',
  },
  {
    icon: Store,
    iconColor: 'text-emerald-400',
    gradient: 'from-emerald-900 via-teal-900 to-cyan-900',
    borderColor: 'border-emerald-500/50',
    accentBar: 'from-emerald-500 via-teal-500 to-cyan-500',
    title: 'Explore the Trading Post',
    titleIcon: BookOpen,
    description: 'Discover adventures shared by the community, post your own creations, and find special items and homebrew content!',
    tags: [
      { icon: BookOpen, label: 'Adventures' },
      { icon: Gem, label: 'Special Items' },
    ],
    actionLabel: 'Browse the Trading Post',
    actionIcon: Store,
    actionHref: '/trading-post',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    dismissClass: 'text-emerald-300 hover:text-emerald-100 hover:bg-emerald-800/50',
    dismissTextClass: 'text-emerald-300/70',
  },
];

function getNextPopupIndex(): number {
  try {
    const lastIndex = localStorage.getItem(LAST_POPUP_INDEX_KEY);
    if (lastIndex !== null) {
      return (parseInt(lastIndex) + 1) % POPUPS.length;
    }
  } catch {}
  return Math.floor(Math.random() * POPUPS.length);
}

export function HearthReminder() {
  const [isVisible, setIsVisible] = useState(false);
  const [popupIndex, setPopupIndex] = useState(0);

  useEffect(() => {
    const checkAndShowReminder = () => {
      const lastShown = localStorage.getItem(LAST_SHOWN_KEY);
      const now = Date.now();

      if (!lastShown || (now - parseInt(lastShown)) > REMINDER_INTERVAL_MS) {
        const nextIndex = getNextPopupIndex();
        const delay = Math.random() * 60000 + 30000;
        setTimeout(() => {
          setPopupIndex(nextIndex);
          setIsVisible(true);
          localStorage.setItem(LAST_SHOWN_KEY, now.toString());
          localStorage.setItem(LAST_POPUP_INDEX_KEY, nextIndex.toString());
        }, delay);
      }
    };

    checkAndShowReminder();
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const popup = POPUPS[popupIndex];
  const Icon = popup.icon;
  const TitleIcon = popup.titleIcon;
  const ActionIcon = popup.actionIcon;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-5 fade-in duration-500">
      <div className={`bg-gradient-to-br ${popup.gradient} rounded-xl shadow-2xl border ${popup.borderColor} overflow-hidden`}>
        <div className="relative p-4">
          <button
            onClick={handleDismiss}
            className={`absolute top-2 right-2 ${popup.dismissTextClass} hover:text-white transition-colors`}
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Icon className={`h-8 w-8 ${popup.iconColor} animate-pulse`} />
            </div>

            <div className="flex-1 pr-4">
              <h3 className="font-bold text-white/90 flex items-center gap-1">
                <TitleIcon className="h-4 w-4" />
                {popup.title}
              </h3>
              <p className="text-sm text-white/70 mt-1">
                {popup.description}
              </p>

              <div className="flex items-center gap-4 mt-3 text-xs text-white/50">
                {popup.tags.map((tag) => {
                  const TagIcon = tag.icon;
                  return (
                    <span key={tag.label} className="flex items-center gap-1">
                      <TagIcon className="h-3 w-3" /> {tag.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Link href={popup.actionHref} className="flex-1">
              <Button
                className={`w-full ${popup.buttonClass}`}
                onClick={handleDismiss}
              >
                <ActionIcon className="h-4 w-4 mr-2" />
                {popup.actionLabel}
              </Button>
            </Link>
            <Button
              variant="ghost"
              className={popup.dismissClass}
              onClick={handleDismiss}
            >
              Later
            </Button>
          </div>
        </div>

        <div className={`h-1 bg-gradient-to-r ${popup.accentBar}`} />
      </div>
    </div>
  );
}
