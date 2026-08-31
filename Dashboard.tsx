@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}

body {
  @apply bg-graphite-900 text-gray-100 font-body antialiased;
}

::selection {
  @apply bg-gold-500/30;
}

/* visible keyboard focus */
a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible {
  outline: 2px solid #C9A24B;
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
