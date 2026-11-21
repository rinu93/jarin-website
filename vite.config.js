import { fileURLToPath } from 'node:url';

// Public website (index) + Member portal. The chatbot lives in /api (a Vercel function).
export default {
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        member: fileURLToPath(new URL('./member.html', import.meta.url)),
      },
    },
  },
};
