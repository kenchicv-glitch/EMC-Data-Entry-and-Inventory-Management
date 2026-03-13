import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

const ThemeToggle: React.FC = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl bg-bg-subtle border border-border-default text-text-secondary hover:text-accent hover:border-accent transition-all duration-200 group relative"
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
            {theme === 'light' ? (
                <Moon size={18} className="group-hover:rotate-12 transition-transform" />
            ) : (
                <Sun size={18} className="group-hover:rotate-45 transition-transform" />
            )}

            {/* Tooltip hint */}
            <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-bg-muted text-[10px] font-black uppercase text-text-primary rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-border-default shadow-sm z-[60]">
                {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </span>
        </button>
    );
};

export default ThemeToggle;
