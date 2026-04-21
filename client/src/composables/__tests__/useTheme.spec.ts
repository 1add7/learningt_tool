import { describe, it, expect } from 'vitest';
import { useTheme } from '../useTheme';

describe('useTheme', () => {
  it('should initialize with default theme', () => {
    const { isDark, currentTheme } = useTheme();
    
    expect(isDark.value).toBe(false);
    expect(currentTheme.value).toBe('blue');
  });

  it('should toggle theme correctly', () => {
    const { isDark, currentTheme, toggleTheme } = useTheme();
    
    expect(isDark.value).toBe(false);
    expect(currentTheme.value).toBe('blue');
    
    toggleTheme();
    
    expect(isDark.value).toBe(true);
    expect(currentTheme.value).toBe('black');
    
    toggleTheme();
    
    expect(isDark.value).toBe(false);
    expect(currentTheme.value).toBe('blue');
  });
});
