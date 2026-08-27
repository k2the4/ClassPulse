import type { Config } from 'tailwindcss';
export default { content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'], theme: { extend: { colors: { ink: '#14213d', sky: '#e8f4fb' } } }, plugins: [] } satisfies Config;
