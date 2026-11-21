# JARIN Fitness Studio · Website

Public website (black and copper), the **Ask JARIN** chat assistant, and the Member portal at `/member`.
Staff use the separate **jarin-dashboard** project.

## Deploy on Vercel
1. Import this repository in Vercel. Framework preset: **Vite** (build `npm run build`, output `dist`).
2. Environment variables (Production + Preview):

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://yuvcjkdinbmjwfjwbxeb.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the project's anon key (Supabase → Project Settings → API). Public by design. |
| `ANTHROPIC_API_KEY` | your Claude API key from console.anthropic.com. Enter it only in Vercel. |
| `CHAT_MODEL` *(optional)* | defaults to `claude-opus-5-5`. Set `claude-haiku-5-5` for a much cheaper assistant. |

3. Deploy. Without `ANTHROPIC_API_KEY` the assistant still works in guided mode (fixed answers + call-back form).

## Edit gym details
- **Owner and Manager, no code:** Employee Dashboard → **Website content** (plans, fees, benefits, extra services,
  opening hours, hero facts, terms), **Offers** (seasonal, student, special and referral offers with prices), and
  **Themes & visuals** (workout themes, logo animations). Changes appear on the website and in the chat within seconds.
- **In code:** address, contact, training styles, equipment and member-app features are in `site-config.js`.
  Logo animations live in `public/media/` (720px MP4 + poster JPG).

## Where enquiries go
Free-trial form and chat leads are saved to the `enquiries` table with source *Website form* or *Chatbot*
(chat leads include the conversation) and appear in the Employee Dashboard → Enquiries.

## Local development
```bash
npm install
npm run dev
```
