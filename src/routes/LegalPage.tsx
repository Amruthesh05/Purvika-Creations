import { Link, useParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { RETURN_WINDOW_DAYS, HISTORY, EXCELLENCE } from '@/lib/brand';

type LegalPageType = 'privacy' | 'terms' | 'refunds' | 'brand';

interface LegalSection {
  heading: string;
  paragraphs: string[];
}

interface LegalDocument {
  title: string;
  intro: string;
  sections: LegalSection[];
}

const LAST_UPDATED = 'November 2026';

const documents: Record<Exclude<LegalPageType, 'brand'>, LegalDocument> = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'This policy explains what information Styvio collects when you shop with us, how we use it, and the choices you have.',
    sections: [
      {
        heading: 'Information we collect',
        paragraphs: [
          'When you create an account or place an order, we collect your email address, name, phone number, delivery address, and the items you purchase.',
          'We also store basic technical information such as your sign-in session and the pages you visit, so the site works correctly for you.',
        ],
      },
      {
        heading: 'How we use your information',
        paragraphs: [
          'We use your details to process and deliver orders, send order updates, respond to support requests, and keep your account secure.',
          'We do not sell your personal information. We share it only with the delivery and payment partners needed to complete your order.',
        ],
      },
      {
        heading: 'Payments',
        paragraphs: [
          'Online payments are handled by our payment provider. Styvio does not store your full card details.',
        ],
      },
      {
        heading: 'Your choices',
        paragraphs: [
          'You can update your name, phone number, and saved addresses from your account page at any time.',
          'To ask for your data to be corrected or deleted, contact us through the links in the footer. We may keep order records where the law requires it.',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    intro: 'By using the Styvio website and placing an order, you agree to the terms below. Please read them carefully.',
    sections: [
      {
        heading: 'Using the site',
        paragraphs: [
          'You agree to provide accurate information when creating an account or placing an order, and to use the site only for lawful purposes.',
        ],
      },
      {
        heading: 'Products and pricing',
        paragraphs: [
          'We make every effort to show product colours, sizes, and descriptions accurately. Slight variations may occur between screen and physical product.',
          'Prices and availability may change without notice. The price shown at checkout is the price you pay.',
        ],
      },
      {
        heading: 'Orders',
        paragraphs: [
          'An order is confirmed once payment is received or, for cash on delivery orders, once we confirm it. We may cancel an order if a product is unavailable or if the order information is incorrect.',
        ],
      },
      {
        heading: 'Custom printed items',
        paragraphs: [
          'Custom printed pieces are made to order. Please check your design details before placing your order. Replacements for manufacturing defects are handled under our Replacement Policy.',
        ],
      },
      {
        heading: 'Intellectual property',
        paragraphs: [
          'The Styvio name, logo, product designs, and site content belong to Styvio. You may not copy or reuse them without written permission.',
        ],
      },
      {
        heading: 'Changes to these terms',
        paragraphs: [
          `We may update these terms from time to time. The latest version is always published on this page. Last updated ${LAST_UPDATED}.`,
        ],
      },
    ],
  },
  refunds: {
    title: 'Replacement Policy',
    intro: 'If your Styvio piece arrives with a manufacturing defect, we will replace it. This page explains what is covered and how to ask for a replacement.',
    sections: [
      {
        heading: 'Replacement window',
        paragraphs: [
          `Replacement requests must be made within ${RETURN_WINDOW_DAYS} days of delivery.`,
        ],
      },
      {
        heading: 'What is covered',
        paragraphs: [
          'We offer replacements only for manufacturing defects, such as faulty stitching, tears, or fabric flaws that were present when your item arrived.',
        ],
      },
      {
        heading: 'What is not covered',
        paragraphs: [
          'Wear, washing, alteration, or damage after delivery. Size or fit preferences, change of mind, and custom printed designs are not eligible for replacement.',
        ],
      },
      {
        heading: 'How to request a replacement',
        paragraphs: [
          'Reach out to us on WhatsApp or Instagram within the window with your order number, the item name, and a clear photo or video of the defect. Our team will confirm and arrange the replacement.',
          'Replacements depend on stock. We do not issue refunds under this policy.',
        ],
      },
    ],
  },
};

const brandContent = {
  title: 'About Styvio',
  intro: 'Premium streetwear built for the heavyweight era.',
  history: HISTORY,
  excellence: EXCELLENCE,
};

function LegalDocumentView({ doc }: { doc: LegalDocument }) {
  return (
    <article className="rounded-2xl border border-ink-border bg-ink-surface p-6 shadow-sm sm:p-10">
      <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">{doc.title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-text-muted">{doc.intro}</p>
      <div className="mt-8 space-y-8">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-base font-semibold text-text">{section.heading}</h2>
            <div className="mt-2 space-y-3">
              {section.paragraphs.map((p) => (
                <p key={p} className="text-sm leading-relaxed text-text-muted">{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

function BrandView() {
  return (
    <article className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">{brandContent.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">{brandContent.intro}</p>
      </header>
      <section className="space-y-6">
        {brandContent.history.map((item) => (
          <div key={item.title} className="rounded-2xl border border-ink-border bg-ink-surface p-6">
            <h2 className="text-base font-semibold text-text">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">{item.text}</p>
          </div>
        ))}
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {brandContent.excellence.map((item) => (
          <div key={item.title} className="rounded-2xl border border-ink-border bg-ink-surface p-6">
            <h3 className="text-sm font-semibold text-text">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">{item.text}</p>
          </div>
        ))}
      </section>
    </article>
  );
}

export function LegalPage() {
  const { type } = useParams<{ type: LegalPageType }>();
  const pageType: LegalPageType = type === 'terms' || type === 'refunds' || type === 'brand' ? type : 'privacy';

  return (
    <div className="flex min-h-screen flex-col bg-ink-page">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        {pageType === 'brand' ? <BrandView /> : <LegalDocumentView doc={documents[pageType]} />}
        <Link to="/" className="mt-8 inline-flex text-sm font-medium text-flame-300 transition-colors hover:text-flame-400 hover:underline">
          Back to Styvio
        </Link>
      </main>
      <Footer />
    </div>
  );
}
