import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  selectedGroupId: string | null;
}

function getInitialTheme(): 'light' | 'dark' {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const initialState: UIState = {
  theme: getInitialTheme(),
  sidebarOpen: true,
  selectedGroupId: localStorage.getItem('selectedGroupId'),
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleTheme(state) {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', state.theme);
      document.documentElement.classList.toggle('dark', state.theme === 'dark');
    },
    setTheme(state, action: PayloadAction<'light' | 'dark'>) {
      state.theme = action.payload;
      localStorage.setItem('theme', action.payload);
      document.documentElement.classList.toggle('dark', action.payload === 'dark');
    },
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSelectedGroup(state, action: PayloadAction<string>) {
      state.selectedGroupId = action.payload;
      localStorage.setItem('selectedGroupId', action.payload);
    },
  },
});

export const { toggleTheme, setTheme, toggleSidebar, setSelectedGroup } = uiSlice.actions;
export default uiSlice.reducer;
