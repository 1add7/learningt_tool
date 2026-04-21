import { ref, watch, onMounted } from 'vue';

export type Theme = 'black' | 'blue';

export function useTheme() {
  const isDark = ref(false);
  const currentTheme = ref<Theme>('blue');

  const applyTheme = (theme: Theme) => {
    if (theme === 'black') {
      document.documentElement.setAttribute('data-theme', 'black');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  const toggleTheme = () => {
    currentTheme.value = currentTheme.value === 'black' ? 'blue' : 'black';
    isDark.value = currentTheme.value === 'black';
  };

  const initTheme = () => {
    const savedTheme = localStorage.getItem('treeTheme') as Theme | null;
    if (savedTheme) {
      currentTheme.value = savedTheme;
      isDark.value = savedTheme === 'black';
    }
    applyTheme(currentTheme.value);
  };

  watch(currentTheme, (newTheme) => {
    applyTheme(newTheme);
    localStorage.setItem('treeTheme', newTheme);
  });

  onMounted(() => {
    initTheme();
  });

  return {
    isDark,
    currentTheme,
    toggleTheme,
    initTheme
  };
}
