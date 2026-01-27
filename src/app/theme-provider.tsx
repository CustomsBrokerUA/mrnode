'use client';

import { useEffect } from 'react';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // Apply theme on mount
        const applyTheme = (value: 'light' | 'dark' | 'system') => {
            if (typeof window === 'undefined') return;
            
            // Check if we're on a dashboard page
            const path = window.location.pathname;
            const isDashboardPage = path.startsWith('/dashboard');
            
            // Force light theme for non-dashboard pages
            if (!isDashboardPage) {
                const root = document.documentElement;
                const body = document.body;
                root.classList.remove('light', 'dark');
                body.classList.remove('light', 'dark');
                root.removeAttribute('data-theme');
                body.removeAttribute('data-theme');
                root.classList.add('light');
                body.classList.add('light');
                root.setAttribute('data-theme', 'light');
                body.setAttribute('data-theme', 'light');
                return;
            }
            
            const root = document.documentElement;
            const body = document.body;

            // Remove all theme classes and attributes
            root.classList.remove('light', 'dark');
            body.classList.remove('light', 'dark');
            root.removeAttribute('data-theme');
            body.removeAttribute('data-theme');

            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            const resolved = value === 'system' ? (prefersDark ? 'dark' : 'light') : value;

            if (resolved === 'light') {
                root.classList.add('light');
                body.classList.add('light');
                root.setAttribute('data-theme', 'light');
                body.setAttribute('data-theme', 'light');
            } else {
                root.classList.add('dark');
                body.classList.add('dark');
                root.setAttribute('data-theme', 'dark');
                body.setAttribute('data-theme', 'dark');
            }
        };

        // Get theme from localStorage
        const savedTheme = localStorage.getItem('appTheme') as 'light' | 'dark' | 'system' | null;
        const theme = savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') 
            ? savedTheme 
            : 'light';
        
        applyTheme(theme);

        // Listen for theme changes from settings page
        const handleThemeUpdate = () => {
            const path = window.location.pathname;
            const isDashboardPage = path.startsWith('/dashboard');
            if (!isDashboardPage) {
                applyTheme('light'); // Force light for non-dashboard pages
                return;
            }
            const currentTheme = localStorage.getItem('appTheme') as 'light' | 'dark' | 'system' | null;
            if (currentTheme && (currentTheme === 'light' || currentTheme === 'dark' || currentTheme === 'system')) {
                applyTheme(currentTheme);
            } else {
                applyTheme('light');
            }
        };

        window.addEventListener('appThemeUpdated', handleThemeUpdate);
        
        // Listen for system theme changes if using system theme
        if (theme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleSystemChange = () => {
                const path = window.location.pathname;
                const isDashboardPage = path.startsWith('/dashboard');
                if (!isDashboardPage) {
                    applyTheme('light'); // Force light for non-dashboard pages
                    return;
                }
                const currentTheme = localStorage.getItem('appTheme');
                if (currentTheme === 'system') {
                    applyTheme('system');
                }
            };
            mediaQuery.addEventListener('change', handleSystemChange);
            
            return () => {
                window.removeEventListener('appThemeUpdated', handleThemeUpdate);
                mediaQuery.removeEventListener('change', handleSystemChange);
            };
        }
        
        // Listen for route changes to apply theme correctly
        const handleRouteChange = () => {
            applyTheme(theme);
        };
        
        window.addEventListener('popstate', handleRouteChange);

        return () => {
            window.removeEventListener('appThemeUpdated', handleThemeUpdate);
        };
    }, []);

    return <>{children}</>;
}
