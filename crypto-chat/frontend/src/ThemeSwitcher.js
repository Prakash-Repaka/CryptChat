import React from 'react';
import { useTheme } from './ThemeContext';
import './ThemeSwitcher.css';

const ThemeSwitcher = () => {
    const { theme, changeTheme } = useTheme();

    const themeOptions = [
        { value: 'dark', label: '🌙 Dark', icon: '🌙' },
        { value: 'light', label: '☀️ Light', icon: '☀️' },
        { value: 'cyberpunk', label: '⚡ Cyberpunk', icon: '⚡' }
    ];

    return (
        <div className="theme-switcher">
            <label className="theme-label">Theme:</label>
            <div className="theme-options">
                {themeOptions.map((option) => (
                    <button
                        key={option.value}
                        className={`theme-btn ${theme === option.value ? 'active' : ''}`}
                        onClick={() => changeTheme(option.value)}
                        title={option.label}
                    >
                        <span className="theme-icon">{option.icon}</span>
                        <span className="theme-name">{option.label.split(' ')[1]}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default ThemeSwitcher;
