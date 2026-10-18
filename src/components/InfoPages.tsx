import { useState } from 'react';
import { ChevronDown, CheckCircle2, Send, Mail, Heart, Leaf, Users, ShieldCheck, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { SUPPORT_EMAIL, POLICIES_LAST_UPDATED } from '@/lib/config';

function PageShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-8 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 mb-1">{title}</h1>
      {subtitle && <p className="text-ink-600 text-sm mb-6">{subtitle}</p>}
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg font-bold text-ink-900 mb-2">{title}</h2>
      <div className="text-sm text-ink-700 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-ink-900/5 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 py-3 text-left font-semibold text-ink-900 text-sm"
        aria-expanded={open}
      >
        {q}
        <ChevronDown size={18} className={`flex-shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="pb-4 text-sm text-ink-700 leading-relaxed space-y-2">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Help & Support
// ---------------------------------------------------------------------------

export const SUPPORT_TOPICS = [
  { value: 'reservation', label: 'A reservation' },
  { value: 'collection', label: 'Collecting my box' },
  { value: 'cancellation', label: 'Cancelling or changing a reservation' },
  { value: 'food_safety', label: 'A food safety concern' },
  { value: 'account', label: 'My account or login' },
  { value: 'business', label: 'A business or listing' },
  { value: 'feedback', label: 'Feedback or a suggestion' },
  { value: 'other', label: 'Something else' },
] as const;

export function HelpSupportPage({ initialTopic = 'reservation' }: { initialTopic?: string }) {
  const { user } = useAuth();
  const [name, setName] = useState((user?.user_metadata?.full_name as string | undefined) ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [topic, setTopic] = useState(initialTopic);
  const [pickupCode, setPickupCode] = useState('');
  const [message, setMessage] = useState('');
  const [trap, setTrap] = useState(''); // hidden field: real people never fill it in
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setError(null);
    if (name.trim().length < 2) return setError('Please enter your name.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Please enter a valid email address.');
    if (message.trim().length < 10) return setError('Please write a message of at least 10 characters.');
    if (trap) {
      setSent(true);
      return;
    }
    setSending(true);
    const { error: rpcError } = await supabase.rpc('submit_support_request', {
      p_name: name.trim(),
      p_email: email.trim(),
      p_topic: topic,
      p_message: message.trim(),
      p_pickup_code: pickupCode.trim() || null,
    });
    setSending(false);
    if (rpcError) {
      setError(rpcError.message || 'Could not send your message. Please try again.');
      return;
    }
    setSent(true);
  };

  return (
    <PageShell title="Help & Support" subtitle="Answers to common questions, and a way to reach us.">
      <Section title="Reservations">
        <div>
          <Faq q="How do I reserve a meal box?">
            <p>
              Sign in or create a customer account, open a listing in Discover Food, and tap "Reserve This Box".
              Confirm your name and a valid 10-digit mobile number, choose how many boxes you want, and confirm. You'll
              get a pickup code, which is also saved under My Reservations.
            </p>
          </Faq>
          <Faq q="Why do I need an account to reserve?">
            <p>
              Reservations are linked to a real account and a working phone number, so businesses can reach you about
              your pickup and we can look into problems.
            </p>
          </Faq>
          <Faq q="Do I pay through Luck Bite?">
            <p>
              Luck Bite does not take payments in the app at the moment. The price shown is the price the business has
              listed for the box. Any payment is arranged between you and the business when you collect.
            </p>
          </Faq>
          <Faq q="Where can I find my pickup code?">
            <p>Open My Reservations. Each reservation shows its pickup code, status and the business to collect from.</p>
          </Faq>
          <Faq q="Why does a listing say Sold out or Unavailable?">
            <p>
              Every box has a limited quantity. Once all boxes are reserved, the listing is shown as unavailable. If a
              reservation is cancelled, its boxes go back on offer.
            </p>
          </Faq>
        </div>
      </Section>

      <Section title="Collection deadlines">
        <div>
          <Faq q='What does "Available till" mean?'>
            <p>
              It is the latest time of day the business has said you can collect. Please arrive before then. Once the
              time has passed, a listing shows "Collection time ended".
            </p>
          </Faq>
          <Faq q="What if I am late?">
            <p>
              The business decides what to do. It may cancel your reservation and offer the box to someone else. If you
              are running late, contact the business, or us using the form below.
            </p>
          </Faq>
          <Faq q="What should I bring when I collect?">
            <p>Your pickup code and the phone number you gave when you reserved.</p>
          </Faq>
        </div>
      </Section>

      <Section title="Cancellations">
        <div>
          <Faq q="Can I cancel a reservation?">
            <p>
              Not inside the app yet. If you can no longer collect, please tell us using the form below and include
              your pickup code, and contact the business if you can. The business can mark the reservation as
              cancelled, which puts the box back on offer for someone else.
            </p>
          </Faq>
          <Faq q="Is there a refund?">
            <p>
              Because Luck Bite does not take payments in the app, there is nothing for us to refund. If you paid a
              business directly and something went wrong, contact the business first, and let us know if you need help.
            </p>
          </Faq>
        </div>
      </Section>

      <Section title="Food information">
        <div>
          <Faq q="Where can I see allergen and storage information?">
            <p>
              On each listing's details page, under "Allergen & Storage Info". If it is empty or unclear, ask the
              business before you collect. A meal box may contain allergens even if they are not listed, so if you have
              an allergy, always check with the business directly.
            </p>
          </Faq>
          <Faq q="How do I know the food is safe?">
            <p>
              Please read "Food Safety & Trust" in the menu. It explains how businesses are verified, what verification
              does and does not mean, and what to check before you eat.
            </p>
          </Faq>
        </div>
      </Section>

      <Section title="Account problems">
        <div>
          <Faq q="I did not get my verification email">
            <p>
              Check your spam folder first. Make sure you typed your email correctly when you signed up. If it still
              does not arrive after a few minutes, send us a message below.
            </p>
          </Faq>
          <Faq q="I forgot my password">
            <p>
              Choose "Forgot password?" on the sign-in window, enter your email, and follow the link we send you. You
              can also use "Reset password" in My Account.
            </p>
          </Faq>
          <Faq q="I cannot sign in because my email is used for another account type">
            <p>
              Customer and business accounts are kept separate. Use the sign-in for the type of account you created, or
              use a different email address for the other type.
            </p>
          </Faq>
          <Faq q="How do I change my phone number or other details?">
            <p>Open My Account and edit your phone number, date of birth and gender there.</p>
          </Faq>
          <Faq q="How do I delete my account or ask for my data?">
            <p>Send us a message below with the topic "My account or login", and tell us what you need.</p>
          </Faq>
        </div>
      </Section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-ink-900 mb-1">Contact us</h2>
        <p className="text-sm text-ink-600 mb-4">
          Send us a message and we will get back to you by email as soon as we can.
          {SUPPORT_EMAIL && (
            <>
              {' '}You can also email us at{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-orange-600 hover:underline">
                {SUPPORT_EMAIL}
              </a>
              .
            </>
          )}
        </p>

        {sent ? (
          <div className="text-center py-6">
            <CheckCircle2 size={36} className="mx-auto text-green-600 mb-2" />
            <p className="font-semibold text-ink-900">Thank you, your message has been sent.</p>
            <p className="text-sm text-ink-600 mt-1">We'll get back to you at {email}.</p>
            <button
              onClick={() => {
                setSent(false);
                setMessage('');
                setPickupCode('');
              }}
              className="btn-secondary mt-4"
            >
              Send another message
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label-field">Your name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="label-field">Email address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label-field">What is it about?</label>
                <select value={topic} onChange={(e) => setTopic(e.target.value)} className="input-field">
                  {SUPPORT_TOPICS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field">Pickup code (if it is about a reservation)</label>
                <input
                  type="text"
                  value={pickupCode}
                  onChange={(e) => setPickupCode(e.target.value.toUpperCase().slice(0, 20))}
                  placeholder="LB-XXXXXX"
                  className="input-field"
                />
              </div>
            </div>
            <div>
              <label className="label-field">Your message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
                rows={5}
                className="input-field"
                placeholder="Tell us what happened and how we can help."
              />
            </div>
            {/* Hidden spam trap */}
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={trap}
              onChange={(e) => setTrap(e.target.value)}
              className="hidden"
              aria-hidden="true"
            />
            {error && (
              <div className="rounded-xl bg-error-100 border border-error-500/20 p-3">
                <p className="text-sm text-error-700">{error}</p>
              </div>
            )}
            <button onClick={handleSend} disabled={sending} className="btn-primary">
              <Send size={16} /> {sending ? 'Sending…' : 'Send message'}
            </button>
          </div>
        )}
      </section>

      {SUPPORT_EMAIL && (
        <p className="text-xs text-ink-500 flex items-center gap-1.5">
          <Mail size={14} /> {SUPPORT_EMAIL}
        </p>
      )}
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// About Luck Bite
// ---------------------------------------------------------------------------

export function AboutPage() {
  return (
    <PageShell title="About Luck Bite" subtitle="Good food should be eaten, not thrown away.">
      <Section title="Our mission">
        <p>
          Restaurants, cafés and bakeries often end the day with good food they were not able to sell. Luck Bite helps
          food businesses recover some value from that safe surplus by offering it as meal boxes at a lower price. At
          the same time, it makes affordable meals easier to find for students and for anyone who watches their budget.
        </p>
      </Section>

      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { icon: <Leaf size={22} />, title: 'Less waste', text: 'Surplus food gets eaten instead of thrown away.' },
          { icon: <Users size={22} />, title: 'Affordable meals', text: 'Lower prices help students and others eat well.' },
          { icon: <Heart size={22} />, title: 'Fair to businesses', text: 'Businesses recover value from food they would lose.' },
        ].map((v) => (
          <div key={v.title} className="card p-5">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center mb-3">
              {v.icon}
            </div>
            <h3 className="font-bold text-ink-900 mb-1">{v.title}</h3>
            <p className="text-sm text-ink-600">{v.text}</p>
          </div>
        ))}
      </div>

      <Section title="How it works">
        <Bullets
          items={[
            'Verified food businesses list their surplus meal boxes with a price, a quantity and a time to collect by.',
            'You find boxes near you in Discover Food and reserve the ones you want.',
            'You collect from the business before the "Available till" time using your pickup code.',
          ]}
        />
      </Section>

      <Section title="Where we are today">
        <p>
          Luck Bite is an early-stage project. Some features are still being built, and some things may change. If you
          have an idea or run into a problem, please tell us through Help & Support. Your feedback shapes what we build
          next.
        </p>
      </Section>
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Food Safety & Trust
// ---------------------------------------------------------------------------

export function FoodSafetyPage({ onReportConcern }: { onReportConcern: () => void }) {
  return (
    <PageShell
      title="Food Safety & Trust"
      subtitle="How we verify businesses, what to check before you eat, and how to report a concern."
    >
      <Section title="How businesses are verified">
        <p>
          Every business registers with its name, location, contact details and, if it chooses, an FSSAI licence number
          and a supporting document. An administrator reviews each application before the business can list any food.
          A business marked "Verified" has been through this review, based on the information it gave us.
        </p>
        <p className="flex items-start gap-2 rounded-xl bg-warning-100/60 border border-warning-500/20 p-3">
          <AlertTriangle size={18} className="text-warning-700 flex-shrink-0 mt-0.5" />
          <span>
            Verification is not a food safety inspection or certification, and it is not a guarantee about any
            particular meal box. Businesses are responsible for the food they offer and for following the food safety
            laws that apply to them.
          </span>
        </p>
      </Section>

      <Section title="What to check before you reserve and eat">
        <Bullets
          items={[
            'Read the description and the "Allergen & Storage Info" on the listing. If you have an allergy, ask the business directly. A box can contain allergens that are not listed.',
            'Note the "Available till" time and collect before it.',
            'When you collect, check that the food looks and smells fresh, and that packaging is intact.',
            'Follow any storage advice, keep food cool or hot as advised, and eat it soon after collection.',
            'If something seems wrong, do not eat it.',
          ]}
        />
      </Section>

      <Section title={'What "surplus" means here'}>
        <p>
          Surplus food is food a business made but did not sell in time. It should still be safe and good to eat.
          Businesses should never list food that is past its safe-to-eat time, and our terms require them to follow
          food safety rules.
        </p>
      </Section>

      <Section title="Report a concern">
        <p>
          If you are unwell after eating food, please get medical help first. You can also report the problem to your
          local food safety authority (in India, this is the FSSAI or your state's food safety department).
        </p>
        <p>
          Please also tell us. Include the business name, the pickup code and what happened. We review reports and may
          contact the business, remove a listing or suspend an account.
        </p>
        <button onClick={onReportConcern} className="btn-primary mt-2">
          <ShieldCheck size={16} /> Report a concern
        </button>
      </Section>
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Terms & Privacy
// ---------------------------------------------------------------------------

export function TermsPrivacyPage({ initial = 'terms' }: { initial?: 'terms' | 'privacy' }) {
  const [which, setWhich] = useState<'terms' | 'privacy'>(initial);

  return (
    <PageShell title="Terms & Privacy" subtitle={`Last updated: ${POLICIES_LAST_UPDATED}`}>
      <div className="flex gap-2">
        {(['terms', 'privacy'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setWhich(t)}
            className={`badge transition-all ${
              which === t ? 'bg-orange-500 text-white' : 'bg-cream-200 text-ink-600 hover:bg-cream-100'
            }`}
          >
            {t === 'terms' ? 'Terms of Use' : 'Privacy Policy'}
          </button>
        ))}
      </div>

      {which === 'terms' ? <TermsOfUse /> : <PrivacyPolicy />}
    </PageShell>
  );
}

function TermsOfUse() {
  return (
    <>
      <Section title="1. About these terms">
        <p>
          By creating an account or using Luck Bite, you agree to these terms. If you do not agree, please do not use
          the service. Luck Bite is an early-stage service, so features may change.
        </p>
      </Section>
      <Section title="2. Who can use Luck Bite">
        <Bullets
          items={[
            'You must be at least 18 years old.',
            'The details you give us, including your phone number, must be accurate and belong to you.',
            'Keep your password safe. You are responsible for activity on your account.',
            'Customer accounts and business accounts are separate.',
          ]}
        />
      </Section>
      <Section title="3. Reservations">
        <p>
          Reserving a box means you are asking to collect it from the business before its "Available till" time,
          using your pickup code. We expect businesses to honour reservations, but we cannot guarantee that every box
          will be ready. We may limit or cancel reservations that look false or abusive.
        </p>
      </Section>
      <Section title="4. Prices and payment">
        <p>
          Prices are set by businesses. Luck Bite does not process payments in the app at this time. Any payment is
          arranged between you and the business when you collect.
        </p>
      </Section>
      <Section title="5. Cancellations and refunds">
        <p>
          You cannot cancel inside the app yet. If you cannot collect, please contact us through Help & Support with
          your pickup code, and contact the business if you can. A business may cancel a reservation, for example if the
          food is no longer available. A cancelled box goes back on offer.
        </p>
        <p>
          Because Luck Bite does not take payment in the app, we have nothing to refund. If you paid a business directly,
          please contact the business first.
        </p>
      </Section>
      <Section title="6. Food information and safety">
        <p>
          Businesses are responsible for the accuracy of their listings (including descriptions, allergen information
          and quantities), for handling food safely, and for holding any licences the law requires. Luck Bite does not
          prepare, store or inspect the food. Please check the information on each listing and use your own judgement
          before you eat. Nothing in these terms limits any rights you have under consumer protection law.
        </p>
      </Section>
      <Section title="7. Using Luck Bite properly">
        <Bullets
          items={[
            'Do not give false details, such as a fake phone number.',
            'Do not reserve boxes you do not plan to collect.',
            'Do not try to access other people\'s data, disrupt the service, or copy it by automated means.',
            'Do not harass businesses, customers or our team, and do not use Luck Bite for anything illegal.',
          ]}
        />
      </Section>
      <Section title="8. For businesses">
        <p>
          You must be authorised to represent the business you register. Keep your details and listings accurate, and
          only list food that is safe to eat. We may approve, reject, suspend or withdraw approval of a business. Changes
          to listings and business status are recorded so we can investigate mistakes and disputes.
        </p>
      </Section>
      <Section title="9. Suspension and removal">
        <p>
          We may suspend or close accounts or remove listings that break these terms or raise a safety concern.
        </p>
      </Section>
      <Section title="10. Our responsibility">
        <p>
          Luck Bite is provided as an early-stage service, "as is". To the extent the law allows, we are not responsible
          for the food offered by businesses, for what businesses do, or for loss caused by a box being unavailable.
          Nothing in these terms excludes responsibility that cannot be excluded by law.
        </p>
      </Section>
      <Section title="11. Changes and governing law">
        <p>
          We may update these terms and will change the "last updated" date when we do. If you keep using Luck Bite
          after a change, you accept the updated terms. These terms are governed by the laws of India. You can contact
          us through Help & Support.
        </p>
      </Section>
    </>
  );
}

function PrivacyPolicy() {
  return (
    <>
      <Section title="1. What we collect">
        <Bullets
          items={[
            'Account details: your name, email address and password. Your password is handled by our sign-in provider and we cannot read it.',
            'Customer profile: your mobile number (required), and your date of birth and gender (optional).',
            'Reservations: the name and phone number you give, the listing, quantity, pickup code and time.',
            'Businesses: business name, address and map location, contact person, email and phone, and, if provided, an FSSAI number and a supporting document.',
            'Favourites: the businesses you save.',
            'Support messages: your name, email, topic, message and any pickup code.',
            'Location: only if you choose "Use my location" (see below).',
          ]}
        />
      </Section>
      <Section title="2. Why we use it">
        <Bullets
          items={[
            'To run Luck Bite: accounts, reservations, nearby search and favourites.',
            'To let a business contact you about a pickup.',
            'To verify businesses and keep the service safe.',
            'To answer your support messages.',
            'To investigate mistakes and disputes. We keep a record of who changed prices, descriptions, availability and business status, and when.',
          ]}
        />
      </Section>
      <Section title="3. Who can see your information">
        <Bullets
          items={[
            'A business can see the name and phone number you give when you reserve one of its boxes.',
            'Your date of birth and gender are not shown to businesses.',
            'Administrators can see the information needed to run Luck Bite, such as business applications, support messages and the change record.',
            'We do not sell your personal information.',
          ]}
        />
      </Section>
      <Section title="4. Your location">
        <p>
          Your browser asks for your permission before sharing your location. If you allow it, your coordinates are
          sent to our database only to find listings within the radius you chose. We do not store them in your profile.
          Your last location, radius and sort choice are kept in your own browser so you do not have to repeat them.
          You can remove them by clearing this site's data in your browser, and you can withdraw permission at any time
          in your browser settings. A business's map pin is public, so customers can find it.
        </p>
      </Section>
      <Section title="5. Services we use">
        <p>
          Luck Bite uses Supabase (database, sign-in and file storage) and Render (website hosting). Business owners
          use OpenStreetMap for place search and maps. When they do, their browser contacts OpenStreetMap servers,
          which receive their IP address and search text. The "View on map" link opens openstreetmap.org. These
          providers handle data for us and may process it in other countries.
        </p>
      </Section>
      <Section title="6. How long we keep it">
        <p>
          We keep your information while your account is active and for as long as we need it for the reasons above,
          for example to resolve a dispute. The record of changes to listings and business status is kept so we can
          investigate problems.
        </p>
      </Section>
      <Section title="7. Your choices">
        <Bullets
          items={[
            'You can see and update your phone number, date of birth and gender in My Account.',
            'Date of birth and gender are optional.',
            'To ask for a correction, a copy of your information, or deletion of your account, send us a message through Help & Support with the topic "My account or login".',
          ]}
        />
      </Section>
      <Section title="8. Security">
        <p>
          We use access rules in our database so that customers and businesses can reach only their own data. No online
          service is completely secure, so please use a strong password that you do not use anywhere else.
        </p>
      </Section>
      <Section title="9. Children, browser storage and changes">
        <p>
          Luck Bite is for adults aged 18 and over, and we do not knowingly collect information from anyone younger. We
          use your browser's storage to keep you signed in and to remember your location settings. We do not use
          advertising or analytics trackers in the app. If we change this policy, we will update the date at the top of
          this page.
        </p>
      </Section>
    </>
  );
}
