import './bootstrap';
import '../css/app.css';
import './i18n';

import { createRoot } from 'react-dom/client';
import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { ThemeSwitcherProvider } from './Context/ThemeSwitcherContext';
import { OnlineStatusProvider } from './Context/OnlineStatusContext';
import { applyThemeColors } from './Utils/brandingTheme';

const appName = import.meta.env.VITE_APP_NAME || 'Rekasir';

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js');
    });
}

// Synchronize branding theme colors on every Inertia navigation
router.on('navigate', (event) => {
    const branding = event.detail.page?.props?.branding;
    if (branding?.colors) {
        applyThemeColors(branding.colors.primary, branding.colors.accent);
    }
});

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) => resolvePageComponent(`./Pages/${name}.jsx`, import.meta.glob('./Pages/**/*.jsx')),
    setup({ el, App, props }) {
        const branding = props.initialPage?.props?.branding;
        if (branding?.colors) {
            applyThemeColors(branding.colors.primary, branding.colors.accent);
        }

        const root = createRoot(el);

        root.render(
            <ThemeSwitcherProvider>
                <OnlineStatusProvider>
                    <App {...props} />
                </OnlineStatusProvider>
            </ThemeSwitcherProvider>
        );
    },
    progress: {
        color: '#4B5563',
    },
});

