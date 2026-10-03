import { createTheme, type MantineColorsTuple } from '@mantine/core';

/** Tema "app tascabile": verde per la teoria e le azioni, arancio per la pratica, angoli morbidi, pulsanti a pillola. */

const verde: MantineColorsTuple = ['#e8f6f1', '#d3ece3', '#a6d9c7', '#76c5aa', '#50b493', '#38a986', '#2f9e83', '#1d7a63', '#156553', '#0a4f40'];
const testo: MantineColorsTuple = ['#eef3f1', '#d8e2de', '#b5c6c0', '#8fa6a0', '#6c7f79', '#4b605a', '#334a44', '#25403a', '#18302b', '#0e1f1b'];
const arancio: MantineColorsTuple = ['#fff4e2', '#fde9cc', '#f9d29b', '#f6ba66', '#f2a541', '#f09829', '#ee911a', '#d37d0c', '#bc6f03', '#9a5a06'];
const rosso: MantineColorsTuple = ['#fdeeea', '#fae3dd', '#f2bcae', '#ea927d', '#e36f55', '#de593c', '#c4472f', '#a83a25', '#8c2f1e', '#6f2416'];
// superfici del tema scuro di Mantine, allineate ai token di stili.css
const dark: MantineColorsTuple = ['#e2eeea', '#a7bbb4', '#82968f', '#3a5149', '#283a34', '#1c2b26', '#16231f', '#0e1816', '#0a1210', '#060c0a'];

export const tema = createTheme({
  primaryColor: 'verde',
  primaryShade: { light: 6, dark: 4 },
  colors: { verde, testo, arancio, rosso, dark },
  black: '#18302b',
  white: '#ffffff',
  fontFamily: 'Figtree, "Segoe UI", system-ui, sans-serif',
  headings: { fontFamily: 'Figtree, "Segoe UI", system-ui, sans-serif', fontWeight: '800' },
  defaultRadius: 'md',
  radius: { xs: '6px', sm: '10px', md: '12px', lg: '16px', xl: '20px' },
  fontSizes: { xs: '0.75rem', sm: '0.875rem', md: '1rem', lg: '1.1875rem', xl: '1.625rem' },
  cursorType: 'pointer',
  focusRing: 'auto',
  components: {
    Button: { defaultProps: { radius: 'xl' } },
    ActionIcon: { defaultProps: { radius: 'xl' } },
    InputWrapper: { defaultProps: { inputWrapperOrder: ['label', 'input', 'description', 'error'] } },
    Modal: { defaultProps: { centered: true, radius: 'lg' } },
    Tooltip: { defaultProps: { withArrow: true, color: 'testo.8' } },
  },
});
