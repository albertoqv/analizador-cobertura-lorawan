/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",   // Next.js App Router
    "./pages/**/*.{js,ts,jsx,tsx}", // Si usas Pages Router (No necesario en App Router)
    "./components/**/*.{js,ts,jsx,tsx}", // Para los componentes
    "./lib/**/*.{js,ts,jsx,tsx}", // Para archivos en la carpeta `lib/`
    "./utils/**/*.{js,ts,jsx,tsx}", // Para archivos en `utils/` si los usas en la UI
  ],
  theme: {
    extend: {
      colors: {
        primary: "#1e3a8a", // Azul oscuro, puedes cambiarlo según la estética del mapa
        secondary: "#64748b", // Gris moderno
        background: "#111827", // Color de fondo oscuro
      },
    },
  },
  plugins: [],
};
