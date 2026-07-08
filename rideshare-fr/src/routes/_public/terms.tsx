import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_public/terms")({
  head: () => ({
    meta: [
      { title: "Terms and Conditions - ChepetsaRide" },
      {
        name: "description",
        content:
          "ChepetsaRide terms and conditions for passengers, drivers, bookings, payments, cancellations, refunds, safety, account use, and platform responsibilities.",
      },
      { property: "og:title", content: "Terms and Conditions - ChepetsaRide" },
      {
        property: "og:description",
        content:
          "Read the terms that govern use of ChepetsaRide by passengers and drivers.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: TermsPage,
});

const sections = [
  {
    title: "1. Acceptance of these Terms",
    body: [
      "By creating an account, signing in, publishing a trip, booking a seat, making a payment, requesting a refund, or otherwise using ChepetsaRide, you agree to these Terms and Conditions, our operational rules, and any policies shown in the app.",
      "If you do not agree, you must not use the platform. We may update these Terms when needed for legal, safety, payment, or product reasons. Continued use after changes means you accept the updated Terms.",
    ],
  },
  {
    title: "2. What ChepetsaRide is",
    body: [
      "ChepetsaRide is a technology platform that helps drivers publish planned trips and allows passengers to book available seats. ChepetsaRide is not a transport operator, bus company, taxi company, insurer, employer, agent of drivers, or agent of passengers.",
      "Drivers are independent users responsible for their own trips, vehicles, permits, conduct, route decisions, road compliance, and passenger handling. Passengers are independent users responsible for choosing trips, arriving on time, and following boarding instructions.",
    ],
  },
  {
    title: "3. Account eligibility and accuracy",
    body: [
      "You must provide accurate, current, and complete information, including your name, phone number, email address, emergency contact, driver details, vehicle details, and payment information where required.",
      "You are responsible for keeping your login credentials, OTPs, boarding codes, and account access secure. Any action taken from your account may be treated as authorized unless we determine otherwise.",
      "We may refuse registration, request additional verification, suspend an account, restrict features, or close an account where information is false, incomplete, suspicious, unsafe, unlawful, or inconsistent with these Terms.",
    ],
  },
  {
    title: "4. Driver responsibilities",
    body: [
      "Drivers must only publish trips they genuinely intend to operate and must provide accurate route, stop, time, seat, fare, vehicle, pickup, and drop-off information.",
      "Drivers are responsible for having a roadworthy vehicle, valid documents, valid driving authority, lawful insurance where applicable, and compliance with all road, traffic, tax, licensing, passenger, and safety laws.",
      "Drivers must not overload vehicles, carry passengers outside legal limits, demand unauthorized extra payments, misuse passenger information, bypass the platform payment process, harass passengers, or allow unverified passengers to board.",
      "A driver must verify boarding codes through the platform where required. Failure to verify passengers correctly may affect payment release, disputes, refund handling, account standing, and platform access.",
    ],
  },
  {
    title: "5. Passenger responsibilities",
    body: [
      "Passengers must provide accurate traveler details, emergency contact details, pickup and drop-off information, and payment information. If booking for other travelers, you confirm you are authorized to provide their details and accept these Terms on their behalf for that booking.",
      "Passengers must arrive at the boarding point on time, carry any required identification, follow reasonable safety instructions, and give the boarding code only to the correct driver at boarding time.",
      "Passengers must not harass drivers or other passengers, carry illegal or dangerous items, damage vehicles, avoid payment, create false disputes, or use another person's account or payment details without authority.",
    ],
  },
  {
    title: "6. Bookings, seats, routes, and schedules",
    body: [
      "A booking is subject to seat availability, payment confirmation, route availability, driver approval where applicable, and platform checks. A displayed trip does not guarantee that a seat is available until the booking and payment flow is completed.",
      "Routes, stops, departure times, arrival times, fares, vehicles, and seats may change due to driver updates, road conditions, safety issues, weather, police checks, delays, breakdowns, cancellations, or operational reasons.",
      "ChepetsaRide may reserve seats temporarily during payment processing to reduce double-booking risk. A reservation can expire or be released if payment is not completed, verification fails, or the transaction is abandoned.",
    ],
  },
  {
    title: "7. Payments, fees, and payouts",
    body: [
      "Payments are processed through supported third-party payment providers. You authorize ChepetsaRide and its payment providers to process payments, fees, refunds, reversals, settlements, and payout-related checks connected to your use of the platform.",
      "The amount shown at checkout may include fare, platform fees, provider charges, convenience fees, payout charges, taxes, or other applicable amounts. Fees may vary by route, payment method, provider, timing, refund status, and operational rules.",
      "Drivers receive payouts only according to the platform's payout rules and after required checks, including payment confirmation, boarding verification, trip status, dispute status, refund status, and fraud review. We may delay, withhold, reverse, or adjust payouts where required for safety, fraud, chargebacks, refunds, legal compliance, or error correction.",
    ],
  },
  {
    title: "8. Cancellations and refunds",
    body: [
      "Cancellation and refund eligibility depends on booking status, payment status, trip status, boarding verification, timing, driver action, passenger action, provider confirmation, and platform rules shown at the time of cancellation.",
      "Refund amounts may be reduced by convenience fees, payment provider charges, payout costs, administrative costs, driver fee shares, penalties, or non-refundable amounts where applicable. The app may show a refund preview before you confirm cancellation.",
      "A refund is not completed merely because a request is submitted or a webhook is received. We may verify payout status with the payment provider before marking a refund complete, cancelling the booking, returning seats, or updating wallet/payment records.",
      "We may reject, delay, review, or manually process refunds where fraud, duplicate claims, incorrect phone numbers, incomplete provider information, chargebacks, suspicious activity, or operational disputes are detected.",
    ],
  },
  {
    title: "9. Safety, conduct, and prohibited use",
    body: [
      "You must use ChepetsaRide lawfully and respectfully. You must not use the platform for fraud, money laundering, illegal transport, trafficking, harassment, threats, abuse, discrimination, impersonation, false documents, spam, platform scraping, security attacks, or bypassing platform fees.",
      "ChepetsaRide may monitor, review, remove, restrict, or report activity that appears unsafe, unlawful, fraudulent, abusive, or harmful to the platform, users, payment providers, or the public.",
      "Emergency situations should be reported to the relevant emergency services or local authorities first. ChepetsaRide may provide support information but is not an emergency response service.",
    ],
  },
  {
    title: "10. Verification and trust features",
    body: [
      "Driver verification, vehicle review, ratings, boarding codes, payment checks, location tools, and account checks are risk-reduction features. They do not guarantee that a user, vehicle, route, trip, or transaction is risk-free.",
      "Users must still exercise judgment, confirm trip details, protect personal information, and report suspicious or unsafe conduct.",
    ],
  },
  {
    title: "11. User content, ratings, and communications",
    body: [
      "You are responsible for information, photos, documents, trip listings, reviews, comments, messages, and other content you submit. You must have the right to submit it and it must not be false, misleading, abusive, unlawful, or infringing.",
      "We may use, store, display, moderate, remove, or share user content as needed to operate the platform, process bookings, support disputes, enforce these Terms, improve safety, comply with law, and protect our rights.",
    ],
  },
  {
    title: "12. Privacy and data use",
    body: [
      "We collect and use account, trip, booking, payment, device, verification, support, and communication data to operate ChepetsaRide, process transactions, prevent fraud, support users, enforce rules, and comply with legal obligations.",
      "Driver and passenger details may be shared with each other where necessary for a booking, trip, safety, payment, support, or dispute purpose. Payment information may be shared with payment providers and relevant service providers.",
    ],
  },
  {
    title: "13. Disputes and investigations",
    body: [
      "If there is a dispute, we may review booking records, payment records, payout records, refund records, boarding code activity, messages, trip details, user reports, and provider responses.",
      "You agree to cooperate with reasonable requests for information. We may make operational decisions about refunds, payouts, account restrictions, or trip records based on the information available to us.",
    ],
  },
  {
    title: "14. Limitation of liability",
    body: [
      "To the maximum extent permitted by law, ChepetsaRide is not liable for indirect, incidental, special, consequential, punitive, or exemplary losses, including loss of profit, lost opportunity, missed trips, delays, breakdowns, road incidents, user conduct, third-party payment issues, or data loss.",
      "ChepetsaRide is not responsible for the acts, omissions, driving, vehicle condition, route choices, delays, cancellations, communications, or conduct of drivers, passengers, or third parties. Nothing in these Terms excludes liability that cannot be excluded by law.",
    ],
  },
  {
    title: "15. Suspension and termination",
    body: [
      "We may suspend, restrict, or terminate access to ChepetsaRide at any time where we reasonably believe a user has breached these Terms, created risk, provided false information, abused payments or refunds, harmed another user, or exposed the platform to legal, financial, or reputational risk.",
      "Account closure does not remove obligations connected to completed trips, pending payments, refunds, disputes, investigations, fees, chargebacks, or legal compliance.",
    ],
  },
  {
    title: "16. Governing law and contact",
    body: [
      "These Terms are intended to be governed by the applicable laws of Malawi, unless another mandatory law applies. Any dispute should first be raised with ChepetsaRide support so we can attempt to resolve it fairly and promptly.",
      "For questions about these Terms, contact ChepetsaRide support through the contact page or official support channels shown in the app.",
    ],
  },
];

function TermsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:py-16">
      <PageHeader
        eyebrow="Legal"
        title="Terms and Conditions"
        description="These terms govern passenger, driver, booking, payment, cancellation, refund, and platform use on ChepetsaRide."
      />

      <div className="mt-6 rounded-md border border-border bg-card p-4 text-sm text-muted-foreground sm:p-5">
        <p>
          Last updated: July 8, 2026. This page is provided for platform protection and user clarity. It should be
          reviewed by a qualified legal professional before relying on it as final legal advice.
        </p>
      </div>

      <div className="mt-8 space-y-5">
        {sections.map((section) => (
          <section key={section.title} className="border-b border-border pb-5 last:border-b-0">
            <h2 className="font-display text-xl font-semibold text-foreground">
              {section.title}
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
