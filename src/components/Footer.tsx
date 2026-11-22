import { Link } from 'react-router-dom';
import { Instagram, Facebook, MessageCircle } from 'lucide-react';
import { Logo } from '@/components/Logo';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-ink-border bg-ink-surface">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center">
            <Logo height={28} tone="light" />
          </div>
          <div className="flex flex-col items-center gap-3 sm:items-end">
            <div className="flex items-center gap-3">
              <a href="https://wa.me/8747955704" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="text-text-muted transition-colors hover:text-flame-300">
                <MessageCircle className="h-5 w-5" />
              </a>
              <a href="https://www.instagram.com/keennode" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-text-muted transition-colors hover:text-flame-300">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="https://facebook.com/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-text-muted transition-colors hover:text-flame-300">
                <Facebook className="h-5 w-5" />
              </a>
            </div>
            <nav className="flex gap-4 text-xs text-text-muted">
              <Link to="/brand" className="hover:text-flame-300 hover:underline">About</Link>
              <Link to="/privacy" className="hover:text-flame-300 hover:underline">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-flame-300 hover:underline">Terms</Link>
              <Link to="/refunds" className="hover:text-flame-300 hover:underline">Replacement Policy</Link>
            </nav>
            <p className="text-xs text-text-muted">
              &copy; {new Date().getFullYear()} Keen Node. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
