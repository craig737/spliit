import { ApplePwaSplash } from '@/app/apple-pwa-splash'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { ProgressBar } from '@/components/progress-bar'
import { ServiceWorkerRegistration } from '@/components/service-worker-registration'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/toaster'
import { Analytics } from '@/lib/analytics/analytics'
import { getAnalyticsConfig } from '@/lib/analytics/config'
import { effectiveBaseUrl, env } from '@/lib/env'
import { TRPCProvider } from '@/trpc/client'
import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider, useTranslations } from 'next-intl'
import { getLocale, getMessages, getTranslations } from 'next-intl/server'
import { Archivo, Spectral } from 'next/font/google'
import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import './globals.css'

// IHA type system (see iha.klinkhoff.art): Archivo for UI, Spectral for prose.
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-archivo',
  display: 'swap',
})
const spectral = Spectral({
  subsets: ['latin'],
  weight: ['200', '300'],
  style: ['normal', 'italic'],
  variable: '--font-spectral',
  display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Homepage')
  return {
    metadataBase: new URL(effectiveBaseUrl),
    title: {
      default: t('metaTitle'),
      template: '%s · IHA Split',
    },
    description:
      'Shared expenses for the International Hockey Association — ice time, road trips and post-game rounds, settled without the awkward math.',
    openGraph: {
      title: t('metaTitle'),
      description:
        'Shared expenses for the International Hockey Association — ice time, road trips and post-game rounds, settled without the awkward math.',
      images: `/banner.png`,
      type: 'website',
      url: '/',
    },
    twitter: {
      card: 'summary_large_image',
      creator: '@scastiel',
      site: '@scastiel',
      images: `/banner.png`,
      title: t('metaTitle'),
      description:
        'Shared expenses for the International Hockey Association — ice time, road trips and post-game rounds, settled without the awkward math.',
    },
    appleWebApp: {
      capable: true,
      title: 'IHA Split',
    },
    applicationName: 'IHA Split',
    icons: [
      {
        url: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}

export const viewport: Viewport = {
  themeColor: '#0A0B0C',
}

function Content({ children }: { children: React.ReactNode }) {
  const t = useTranslations()
  const home = env.SINGLE_GROUP_ID ? `/groups/${env.SINGLE_GROUP_ID}` : '/'
  const groups = env.SINGLE_GROUP_ID
    ? `/groups/${env.SINGLE_GROUP_ID}`
    : '/groups'
  return (
    <TRPCProvider>
      <header className="fixed top-0 left-0 right-0 h-16 flex justify-between bg-background/70 p-2 border-b backdrop-blur-sm z-50">
        <Link
          className="flex items-center gap-3 px-2 hover:text-primary transition-colors"
          href={home}
        >
          <Image
            src="/logo/64x64.png"
            className="h-9 w-9"
            width={36}
            height={36}
            alt=""
            priority
            unoptimized
          />
          <h1 className="iha-wordmark">
            <span className="hidden sm:inline">
              International Hockey Association
            </span>
            <span className="sm:hidden">IHA</span>
            <span className="text-primary"> · Split</span>
          </h1>
        </Link>
        <div role="navigation" aria-label="Menu" className="flex">
          <ul className="flex items-center text-sm">
            {/* IHA fork: a single-group instance has nowhere else to go and
                one language, so only the theme toggle remains. */}
            {!env.SINGLE_GROUP_ID && (
              <>
                <li>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="-my-3 text-primary"
                  >
                    <Link href={groups}>{t('Header.groups')}</Link>
                  </Button>
                </li>
                <li>
                  <LocaleSwitcher />
                </li>
              </>
            )}
            <li>
              <ThemeToggle />
            </li>
          </ul>
        </div>
      </header>

      <div className="pt-16 flex-1 flex flex-col">{children}</div>

      <Toaster />
    </TRPCProvider>
  )
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const messages = await getMessages()
  const analyticsConfig = await getAnalyticsConfig()
  return (
    <html
      lang={locale}
      dir={['ar', 'he'].includes(locale) ? 'rtl' : 'ltr'}
      suppressHydrationWarning
    >
      <ApplePwaSplash icon="/logo/512x512.png" color="#0A0B0C" />
      <body
        className={`${archivo.variable} ${spectral.variable} min-h-[100dvh] flex flex-col items-stretch bg-background`}
      >
        <NextIntlClientProvider messages={messages}>
          {/* Rendered inside the provider because it reads translations via
              `useTranslations`, which needs NextIntlClientProvider in its
              ancestor tree. */}
          <ServiceWorkerRegistration />
          <Analytics config={analyticsConfig}>
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              enableSystem
              disableTransitionOnChange
            >
              <Suspense>
                <ProgressBar />
              </Suspense>
              <Content>{children}</Content>
            </ThemeProvider>
          </Analytics>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
