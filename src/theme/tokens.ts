// Sistema de tokens semánticos del tema. Único lugar donde viven los
// valores de color de la app. Cualquier hex literal en una pantalla
// debe estar mapeado contra alguno de estos tokens — si un caso no
// encaja en ninguno, se agrega aquí, no en el archivo de la pantalla.

export type ThemeMode = 'dark' | 'light';

export type ThemeTokens = {
    mode: ThemeMode;
    statusBar: 'light-content' | 'dark-content';

    bg: {
        page: string;          // background principal de cada pantalla
        pageMuted: string;     // background levemente más tenue (ej. sheets)
        card: string;          // cards normales sobre la página
        cardElevated: string;  // cards destacados (REFLEJO, etc.)
        input: string;         // background de TextInputs estándar (dentro de modales/cards oscuros)
        inputInverted: string; // input invertido (claro sobre página oscura — iMessage style en dark)
        chip: string;          // background de chips/badges neutrales
        overlay: string;       // background de modal overlay
        scrim: string;         // tint sobre contenido para resaltar destacados
    };

    border: {
        subtle: string;     // bordes casi imperceptibles
        default: string;    // bordes normales de cards
        strong: string;     // bordes con énfasis (focus, separadores)
    };

    text: {
        primary: string;       // texto principal alto contraste
        secondary: string;     // texto secundario
        muted: string;         // texto muted (subtítulos, captions)
        disabled: string;      // texto deshabilitado
        onAccent: string;      // texto blanco sobre fondo de accent
        onInverted: string;    // texto sobre bg.inputInverted (siempre oscuro)
        link: string;          // texto de enlaces
    };

    accent: {
        // Indigo = brand primary
        indigo: string;        // base
        indigoStrong: string;  // hover/pressed
        indigoSoft: string;    // tint background

        // Purple = REFLEJO / patrones / accent secundario
        purple: string;
        purpleStrong: string;
        purpleSoft: string;

        // Estados
        red: string;        // peligro / cerrado / error
        redSoft: string;
        green: string;      // ok / completado
        greenSoft: string;
        amber: string;      // advertencia / estancado
        amberSoft: string;
        sky: string;        // info / feedback
        skySoft: string;
        yellow: string;     // categoría personal / amarillo de marca
        yellowSoft: string;
    };

    shadow: {
        color: string;
        opacity: number;
    };
};

// ─── DARK (default) ──────────────────────────────────────────────────────────
export const darkTokens: ThemeTokens = {
    mode: 'dark',
    statusBar: 'light-content',

    bg: {
        page: '#0a0f1e',
        pageMuted: '#0d1424',
        card: '#151B2C',
        cardElevated: '#1A2236',
        input: '#1e293b',
        inputInverted: '#F1F5F9',
        chip: 'rgba(255, 255, 255, 0.05)',
        overlay: 'rgba(0, 0, 0, 0.55)',
        scrim: 'rgba(255, 255, 255, 0.03)',
    },

    border: {
        subtle: 'rgba(255, 255, 255, 0.05)',
        default: '#1E293B',
        strong: '#334155',
    },

    text: {
        primary: '#F1F5F9',
        secondary: '#cbd5e1',
        muted: '#94a3b8',
        disabled: '#475569',
        onAccent: '#FFFFFF',
        onInverted: '#0F172A',
        link: '#818cf8',
    },

    accent: {
        indigo: '#6366f1',
        indigoStrong: '#4f46e5',
        indigoSoft: 'rgba(99, 102, 241, 0.18)',

        purple: '#a855f7',
        purpleStrong: '#9333EA',
        purpleSoft: 'rgba(168, 85, 247, 0.10)',

        red: '#ef4444',
        redSoft: 'rgba(239, 68, 68, 0.18)',
        green: '#10b981',
        greenSoft: 'rgba(16, 185, 129, 0.15)',
        amber: '#f59e0b',
        amberSoft: 'rgba(245, 158, 11, 0.15)',
        sky: '#38bdf8',
        skySoft: 'rgba(56, 189, 248, 0.18)',
        yellow: '#facc15',
        yellowSoft: 'rgba(250, 204, 21, 0.15)',
    },

    shadow: {
        color: '#000000',
        opacity: 0.35,
    },
};

// ─── LIGHT ───────────────────────────────────────────────────────────────────
export const lightTokens: ThemeTokens = {
    mode: 'light',
    statusBar: 'dark-content',

    bg: {
        page: '#F8FAFC',
        pageMuted: '#F1F5F9',
        card: '#FFFFFF',
        cardElevated: '#FFFFFF',
        input: '#F1F5F9',
        inputInverted: '#FFFFFF',
        chip: 'rgba(15, 23, 42, 0.05)',
        overlay: 'rgba(15, 23, 42, 0.55)',
        scrim: 'rgba(15, 23, 42, 0.03)',
    },

    border: {
        subtle: 'rgba(15, 23, 42, 0.06)',
        default: '#E2E8F0',
        strong: '#CBD5E1',
    },

    text: {
        primary: '#0F172A',
        secondary: '#334155',
        muted: '#64748B',
        disabled: '#94A3B8',
        onAccent: '#FFFFFF',
        onInverted: '#0F172A',
        link: '#4F46E5',
    },

    accent: {
        indigo: '#6366f1',
        indigoStrong: '#4F46E5',
        indigoSoft: 'rgba(99, 102, 241, 0.10)',

        purple: '#7C3AED',
        purpleStrong: '#6D28D9',
        purpleSoft: 'rgba(124, 58, 237, 0.08)',

        red: '#DC2626',
        redSoft: 'rgba(220, 38, 38, 0.10)',
        green: '#059669',
        greenSoft: 'rgba(5, 150, 105, 0.10)',
        amber: '#D97706',
        amberSoft: 'rgba(217, 119, 6, 0.10)',
        sky: '#0284C7',
        skySoft: 'rgba(2, 132, 199, 0.10)',
        yellow: '#CA8A04',
        yellowSoft: 'rgba(202, 138, 4, 0.12)',
    },

    shadow: {
        color: '#0F172A',
        opacity: 0.06,
    },
};

export const tokensByMode: Record<ThemeMode, ThemeTokens> = {
    dark: darkTokens,
    light: lightTokens,
};
