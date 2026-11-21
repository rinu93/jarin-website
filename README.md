# JARIN Fitness Studio · Website

Public website (black and copper), the **Ask JARIN** chat assistant, and the Member portal at `/member`.
Staff use the separate **jarin-dashboard** project.

## Deploy on Vercel
1. Import this repository in Vercel. Framework preset: **Vite** (build `npm run build`, output `dist`).
2. Environment variables (Production + Preview):

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://ifrmtkzllqhhpvoahdwr.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the project's anon key (Supabase → Project Settings → API). Public by design. |
| `ANTHROPIC_API_KEY` | your Claude API key from console.anthropic.com. Enter it only in Vercel. |
| `CHAT_MODEL` *(optional)* | defaults to `claude-opus-5-5`. Set `claude-haiku-5-5` for a much cheaper assistant. |

3. Deploy. Without `ANTHROPIC_API_KEY` the assistant still works in guided mode (fixed answers + call-back form).

## Edit gym details
Everything shown on the site (timings, plans, address, equipment, services, dashboard link) is in `site-config.js`.
The chat assistant reads the same file, plus live offers from the database.

## Where enquiries go
Free-trial form and chat leads are saved to the `enquiries` table with source *Website form* or *Chatbot*
(chat leads include the conversation) and appear in the Employee Dashboard → Enquiries.

## Local development
```bash
npm install
npm run dev
```
