# SitePulse

Production-ready SaaS platform for website performance, SEO, accessibility, and compliance monitoring built with Next.js 14, Supabase, Paddle, Resend, and PageSpeed Insights.

## Quick start

1. Copy `.env.example` to `.env.local` and fill in the required keys.
2. Apply [`supabase/schema.sql`](./supabase/schema.sql) in your Supabase SQL editor.
3. Install dependencies with `npm install`.
4. Run the development server with `npm run dev`.

## Core capabilities

- Supabase email/password auth with protected dashboard routes
- Website management with plan enforcement and scan schedules
- Google PageSpeed Insights scans for mobile and desktop
- PDF report generation and Supabase Storage upload
- Resend-powered email reports and alert emails
- Paddle checkout, webhook handling, sale pricing, and customer portal access
- Responsive landing pages and dashboard analytics

## Deployment

- Target hosting: Vercel
- Required env vars: see `.env.example`
- Scheduled jobs: GitHub Actions triggers the cron routes defined in `.github/workflows/crons.yml`
- GitHub Actions secrets required for cron runs: `SITE_URL` and `CRON_SECRET`
"# Site_pluse" 
