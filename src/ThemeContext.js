import React, { createContext, useState, useEffect, useContext } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        // Load theme from localStorage or default to 'dark'
        return localStorage.getItem('theme') || 'dark';
    });

    useEffect(() => {
        // Apply theme to document root and body
        document.documentElement.setAttribute('data-theme', theme);
        document.body.setAttribute('data-theme', theme);
        // Save to localStorage
        localStorage.setItem('theme', theme);
        console.log('Theme changed to:', theme);
    }, [theme]);

    const changeTheme = (newTheme) => {
        if (['dark', 'light', 'cyberpunk'].includes(newTheme)) {
            setTheme(newTheme);
        }
    };

    const value = {
        theme,
        changeTheme,
        themes: ['dark', 'light', 'cyberpunk']
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export default ThemeContext;
