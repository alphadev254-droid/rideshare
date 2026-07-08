import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { useI18n, type AppLanguage } from "@/lib/i18n";

type TermsSection = {
  title: string;
  body: string[];
};

type TermsContent = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  description: string;
  updated: string;
  legalNote: string;
  sections: TermsSection[];
};

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

const termsContent: Record<AppLanguage, TermsContent> = {
  en: {
    metaTitle: "Terms and Conditions - ChepetsaRide",
    metaDescription:
      "Terms for passengers, drivers, bookings, payments, cancellations, refunds, safety, account use, and platform responsibilities.",
    eyebrow: "Legal",
    title: "Terms and Conditions",
    description:
      "These terms govern passenger, driver, booking, payment, cancellation, refund, and platform use on ChepetsaRide.",
    updated: "Last updated: July 8, 2026.",
    legalNote:
      "This page is provided for platform protection and user clarity. It should be reviewed by a qualified legal professional before relying on it as final legal advice.",
    sections: [
      {
        title: "1. Acceptance of these Terms",
        body: [
          "By creating an account, signing in, publishing a trip, booking a seat, making a payment, requesting a refund, or otherwise using ChepetsaRide, you agree to these Terms and any rules shown in the app.",
          "If you do not agree, you must not use the platform. We may update these Terms for legal, safety, payment, or product reasons. Continued use after changes means you accept the updated Terms.",
        ],
      },
      {
        title: "2. What ChepetsaRide is",
        body: [
          "ChepetsaRide is a technology platform that helps drivers publish planned trips and passengers book available seats. ChepetsaRide is not a transport operator, taxi company, bus company, insurer, employer, or agent of users.",
          "Drivers and passengers are independent users. Drivers remain responsible for their trips, vehicles, documents, route decisions, conduct, and compliance with the law.",
        ],
      },
      {
        title: "3. Accounts and information",
        body: [
          "You must provide accurate and current information, including your name, phone, email, emergency contact, driver details, vehicle details, traveler details, and payment information where required.",
          "You are responsible for keeping your password, OTP, boarding code, and account secure. We may suspend, restrict, or close accounts with false, incomplete, unsafe, suspicious, or unlawful information.",
        ],
      },
      {
        title: "4. Driver responsibilities",
        body: [
          "Drivers must only publish trips they genuinely intend to operate and must provide accurate route, stop, time, seat, fare, vehicle, pickup, and drop-off information.",
          "Drivers are responsible for roadworthy vehicles, valid documents, lawful insurance where applicable, safe driving, legal seat limits, passenger handling, and compliance with traffic and transport laws.",
          "Drivers must not demand unauthorized payments, bypass platform payments, misuse passenger information, overload vehicles, harass users, or allow unverified passengers to board.",
        ],
      },
      {
        title: "5. Passenger responsibilities",
        body: [
          "Passengers must provide accurate booking, traveler, emergency contact, pickup, drop-off, and payment information. If booking for others, you confirm you are authorized to provide their details.",
          "Passengers must arrive on time, follow reasonable safety instructions, protect their boarding code, and share the code only with the correct driver at boarding.",
          "Passengers must not avoid payment, create false disputes, damage vehicles, harass users, carry illegal or dangerous items, or use another person's account or payment details without authority.",
        ],
      },
      {
        title: "6. Bookings, routes, seats, and schedules",
        body: [
          "A booking depends on seat availability, payment confirmation, route availability, driver approval where applicable, and platform checks. A listed trip does not guarantee a confirmed seat until the booking flow is completed.",
          "Routes, stops, times, fares, vehicles, and seats may change because of driver updates, road conditions, weather, police checks, delays, breakdowns, safety issues, cancellations, or operational reasons.",
          "ChepetsaRide may temporarily reserve seats during payment processing. Reservations may expire or be released if payment is not completed or verification fails.",
        ],
      },
      {
        title: "7. Payments, fees, payouts, and refunds",
        body: [
          "Payments are processed through supported third-party providers. You authorize ChepetsaRide and its providers to process payments, fees, refunds, reversals, settlements, and payout checks connected to your use of the platform.",
          "Amounts may include fare, platform fees, provider charges, convenience fees, payout costs, taxes, or other applicable charges. Drivers receive payouts only after required checks such as payment confirmation, boarding verification, trip status, dispute status, refund status, and fraud review.",
          "Cancellation and refund eligibility depends on booking status, payment status, trip status, boarding verification, timing, driver action, passenger action, provider confirmation, and platform rules. Refunds may be reduced by applicable fees and costs.",
          "A refund is not complete only because a request is submitted or a webhook is received. We may verify payout status with the payment provider before marking refunds complete, cancelling bookings, returning seats, or updating wallet/payment records.",
        ],
      },
      {
        title: "8. Safety, conduct, and prohibited use",
        body: [
          "You must use ChepetsaRide lawfully and respectfully. You must not use it for fraud, money laundering, illegal transport, harassment, threats, discrimination, impersonation, false documents, spam, security attacks, or bypassing platform fees.",
          "Driver verification, vehicle review, ratings, boarding codes, payment checks, and account checks reduce risk but do not guarantee that a user, vehicle, route, trip, or transaction is risk-free.",
          "Emergency situations should be reported to emergency services or local authorities first. ChepetsaRide is not an emergency response service.",
        ],
      },
      {
        title: "9. Data, content, disputes, and enforcement",
        body: [
          "We collect and use account, trip, booking, payment, device, verification, support, and communication data to operate the platform, process transactions, prevent fraud, support users, enforce rules, and comply with legal obligations.",
          "You are responsible for content you submit, including documents, photos, listings, messages, ratings, and comments. We may store, display, moderate, remove, or share content where needed for platform operations, safety, support, disputes, law, or enforcement.",
          "For disputes, we may review booking records, payment records, refund records, payout records, boarding code activity, messages, reports, and provider responses. We may make operational decisions based on available information.",
        ],
      },
      {
        title: "10. Liability, suspension, and governing law",
        body: [
          "To the maximum extent permitted by law, ChepetsaRide is not liable for indirect or consequential losses, missed trips, delays, breakdowns, road incidents, user conduct, third-party payment issues, or data loss.",
          "ChepetsaRide is not responsible for the acts, omissions, driving, vehicle condition, route choices, delays, cancellations, communications, or conduct of drivers, passengers, or third parties.",
          "We may suspend, restrict, or terminate access where a user breaches these Terms, creates risk, provides false information, abuses payments/refunds, harms users, or exposes the platform to legal, financial, or reputational risk.",
          "These Terms are intended to be governed by the applicable laws of Malawi, unless mandatory law says otherwise. Questions or disputes should first be raised through ChepetsaRide support.",
        ],
      },
    ],
  },
  ny: {
    metaTitle: "Malamulo ndi Zoyenera Kutsatira - ChepetsaRide",
    metaDescription:
      "Malamulo a okwera, madalaivala, kusungitsa, kulipira, kuletsa, kubweza ndalama, chitetezo, akaunti ndi ntchito ya ChepetsaRide.",
    eyebrow: "Zalamulo",
    title: "Malamulo ndi Zoyenera Kutsatira",
    description:
      "Malamulowa amayang'anira kugwiritsa ntchito ChepetsaRide kwa okwera, madalaivala, kusungitsa, kulipira, kuletsa ndi kubweza ndalama.",
    updated: "Zasinthidwa komaliza: July 8, 2026.",
    legalNote:
      "Tsambali laperekedwa kuti liteteze nsanja ndi kufotokoza bwino kwa ogwiritsa ntchito. Liyenera kuunikidwa ndi katswiri wa malamulo musanaligwiritse ntchito ngati upangiri womaliza wa malamulo.",
    sections: [
      {
        title: "1. Kuvomereza malamulo awa",
        body: [
          "Mukapanga akaunti, kulowa, kusindikiza ulendo, kusungitsa mpando, kulipira, kupempha kubweza ndalama, kapena kugwiritsa ntchito ChepetsaRide, mukuvomereza Malamulowa ndi malamulo ena omwe amaoneka mu app.",
          "Ngati simukuvomereza, musagwiritse ntchito nsanjayi. Titha kusintha Malamulowa pazifukwa za malamulo, chitetezo, malipiro kapena ntchito. Kupitiriza kugwiritsa ntchito kumatanthauza kuti mwavomereza zosinthazo.",
        ],
      },
      {
        title: "2. ChepetsaRide ndi chiyani",
        body: [
          "ChepetsaRide ndi nsanja yaukadaulo yomwe imathandiza madalaivala kusindikiza maulendo omwe akonzekera ndipo okwera kusungitsa mipando yomwe ilipo. ChepetsaRide si kampani yoyendetsa anthu, taxi, basi, inshuwaransi, bwana wa ogwiritsa ntchito, kapena nthumwi yawo.",
          "Madalaivala ndi okwera ndi ogwiritsa ntchito odziyimira pawokha. Driver ali ndi udindo pa ulendo wake, galimoto, zikalata, njira, khalidwe ndi kutsatira malamulo.",
        ],
      },
      {
        title: "3. Akaunti ndi zambiri",
        body: [
          "Muyenera kupereka zambiri zolondola komanso zaposachedwa monga dzina, foni, email, munthu wa emergency, zambiri za driver, galimoto, okwera, ndi malipiro ngati zikufunika.",
          "Muli ndi udindo woteteza password, OTP, boarding code ndi akaunti yanu. Titha kuyimitsa kapena kutseka akaunti yomwe ili ndi zambiri zabodza, zosakwanira, zokayikitsa, zosatetezeka kapena zosaloledwa.",
        ],
      },
      {
        title: "4. Udindo wa madalaivala",
        body: [
          "Madalaivala ayenera kusindikiza maulendo omwe akufuna kuchitadi ndipo ayenera kupereka route, ma stop, nthawi, mipando, mtengo, galimoto, pickup ndi drop-off zolondola.",
          "Driver ali ndi udindo wa galimoto yabwino, zikalata zovomerezeka, inshuwaransi ngati ikufunika, kuyendetsa motetezeka, malire a mipando, kusamalira okwera ndi kutsatira malamulo a msewu ndi transport.",
          "Driver sayenera kufuna ndalama zosavomerezeka, kudutsa malipiro a nsanja, kugwiritsa ntchito molakwika zambiri za okwera, kudzaza galimoto mopitirira, kuvutitsa ogwiritsa ntchito, kapena kulola wokwera wosatsimikizidwa kukwera.",
        ],
      },
      {
        title: "5. Udindo wa okwera",
        body: [
          "Okweza ayenera kupereka zambiri zolondola za booking, okwera ena, emergency contact, pickup, drop-off ndi malipiro. Mukasungitsa kwa ena, mumatsimikizira kuti muli ndi chilolezo chopereka zambiri zawo.",
          "Okweza ayenera kufika pa nthawi yake, kutsatira malangizo a chitetezo, kusunga boarding code mwachinsinsi, ndi kuipereka kwa driver wolondola pa nthawi yokwera.",
          "Okweza sayenera kuthawa kulipira, kupanga madandaulo abodza, kuwononga galimoto, kuvutitsa anthu, kunyamula zinthu zosaloledwa kapena zoopsa, kapena kugwiritsa ntchito akaunti kapena malipiro a munthu wina popanda chilolezo.",
        ],
      },
      {
        title: "6. Kusungitsa, route, mipando ndi nthawi",
        body: [
          "Booking imadalira mipando yomwe ilipo, kutsimikizika kwa malipiro, route yomwe ilipo, kuvomerezedwa kwa driver ngati kukufunika, ndi macheke a nsanja. Ulendo kuoneka pa list sikutanthauza kuti mpando watsimikizika mpaka booking itamalizidwa.",
          "Routes, ma stop, nthawi, mitengo, magalimoto ndi mipando zingasinthe chifukwa cha driver, misewu, nyengo, ma check a apolisi, kuchedwa, kuwonongeka, chitetezo, kuletsa kapena zifukwa za ntchito.",
          "ChepetsaRide ikhoza kusunga mpando kwakanthawi pamene malipiro akukonzedwa. Kusungaku kungathe ngati malipiro sanamalizidwe kapena kutsimikiza kwalephela.",
        ],
      },
      {
        title: "7. Malipiro, ma fee, payouts ndi kubweza ndalama",
        body: [
          "Malipiro amakonzedwa ndi ma payment provider ovomerezeka. Mumalola ChepetsaRide ndi ma provider ake kukonza malipiro, ma fee, refunds, reversals, settlements ndi payout checks zokhudzana ndi ntchito yanu.",
          "Ndalama zingaphatikize fare, platform fees, provider charges, convenience fees, payout costs, tax kapena ndalama zina. Madalaivala amalandira payout pokhapokha macheke ofunika atachitika monga kutsimikiza malipiro, boarding, status ya ulendo, mikangano, refund ndi fraud review.",
          "Kuyenera kwa cancellation ndi refund kumadalira status ya booking, malipiro, ulendo, boarding, nthawi, zochita za driver kapena passenger, kutsimikiza kwa provider ndi malamulo a nsanja. Refund ikhoza kuchepetsedwa ndi ma fee ndi costs.",
          "Refund siyimalizidwa chifukwa choti request yatumizidwa kapena webhook yafika. Titha kutsimikiza payout status ndi payment provider tisanamalize refund, kuletsa booking, kubweza mipando kapena kusintha wallet/payment records.",
        ],
      },
      {
        title: "8. Chitetezo, khalidwe ndi zoletsedwa",
        body: [
          "Muyenera kugwiritsa ntchito ChepetsaRide mwalamulo ndi mwaulemu. Simuyenera kugwiritsa ntchito pa fraud, money laundering, transport yosaloledwa, kuvutitsa, kuopseza, tsankho, kudzitcha munthu wina, zikalata zabodza, spam, security attacks kapena kudutsa ma fee a nsanja.",
          "Driver verification, vehicle review, ratings, boarding codes, payment checks ndi account checks zimachepetsa chiopsezo koma sizitsimikizira kuti user, galimoto, route, ulendo kapena transaction ndi opanda chiopsezo.",
          "Pa emergency, muyenera kuyimbira ma emergency services kapena akuluakulu a boma kaye. ChepetsaRide si emergency response service.",
        ],
      },
      {
        title: "9. Data, content, mikangano ndi enforcement",
        body: [
          "Timasonkhanitsa ndi kugwiritsa ntchito data ya akaunti, ulendo, booking, malipiro, device, verification, support ndi communication kuti nsanja igwire ntchito, kukonza transactions, kuletsa fraud, kuthandiza users, kutsatira malamulo ndi kulimbikitsa rules.",
          "Muli ndi udindo pa zomwe mumatumiza monga zikalata, zithunzi, listings, messages, ratings ndi comments. Titha kusunga, kuonetsa, kuchotsa kapena kugawana content ngati zikufunika pa ntchito, chitetezo, support, mikangano, malamulo kapena enforcement.",
          "Pa mikangano, titha kuona booking records, payment records, refund records, payout records, boarding code activity, messages, reports ndi mayankho a provider. Titha kupanga chisankho potengera zomwe zilipo.",
        ],
      },
      {
        title: "10. Liability, kuyimitsidwa ndi malamulo",
        body: [
          "Malinga ndi zomwe malamulo amalola, ChepetsaRide siyikhala ndi udindo pa zotayika zosalunjika, maulendo ophonya, kuchedwa, kuwonongeka, ngozi za msewu, khalidwe la users, mavuto a third-party payment kapena kutayika kwa data.",
          "ChepetsaRide siyili ndi udindo pa zochita, zolakwa, kuyendetsa, condition ya galimoto, route choices, kuchedwa, cancellations, ma communication kapena khalidwe la madalaivala, okwera kapena anthu ena.",
          "Titha kuyimitsa, kuchepetsa kapena kutseka access ngati user waphwanya Malamulowa, wapanga chiopsezo, wapereka zabodza, wagwiritsa ntchito molakwika malipiro/refunds, wavulaza users kapena waika nsanja pa chiopsezo.",
          "Malamulowa akuyenera kutsatiridwa ndi malamulo a Malawi, pokhapokha ngati malamulo ena okakamiza akunena zina. Mafunso kapena mikangano ayenera kuyamba kuperekedwa ku support ya ChepetsaRide.",
        ],
      },
    ],
  },
  tum: {
    metaTitle: "Malango na Vyakwenera Kulondezga - ChepetsaRide",
    metaDescription:
      "Malango gha wakwera, madalaivala, booking, malipiro, cancellation, refund, chivikiliro, akaunti na ntchito ya ChepetsaRide.",
    eyebrow: "Vyamalango",
    title: "Malango na Vyakwenera Kulondezga",
    description:
      "Malango agha ghakulongosora umo wakwera, madalaivala, booking, malipiro, cancellation, refund na ChepetsaRide vikugwilira ntchito.",
    updated: "Vyasinthika kaumaliro: July 8, 2026.",
    legalNote:
      "Peji iyi yapelekeka kuti yivikilire nsanja na kovwira ŵanthu kupulikiska. Yikwenera kuwunikika na munthu wakumanya malango pambere muyigwiliskire ntchito nga ni ulongozgi wakumalizga wa malango.",
    sections: [
      {
        title: "1. Kuzomera malango agha",
        body: [
          "Para mwapanga akaunti, kunjira, kusindikiza ulendo, kusunga mpando, kulipira, kupempha refund, panji kugwiliskira ntchito ChepetsaRide, mukuzomera Malango agha na rules zinyake izo zikuwoneka mu app.",
          "Usange mukuzomera yayi, mungagwiliskiranga ntchito yayi nsanja iyi. Tingasintha Malango agha pa vifukwa vya malango, chivikiliro, malipiro panji product. Kulutilira kugwiliskira ntchito chikung'anamura kuti mwazomera kusintha.",
        ],
      },
      {
        title: "2. ChepetsaRide ni vichi",
        body: [
          "ChepetsaRide ni nsanja ya technology iyo yikovwira madalaivala kusindikiza maulendo agho ŵanozga ndipo wakwera kusunga mipando iyo yilipo. ChepetsaRide ni transport operator yayi, taxi yayi, basi company yayi, insurer yayi, employer yayi, panji agent wa users yayi.",
          "Madalaivala na wakwera mba independent users. Driver wakukhalabe na udindo pa ulendo, galimoto, documents, route, khalidwe na kulondezga malango.",
        ],
      },
      {
        title: "3. Akaunti na uthenga",
        body: [
          "Mukwenera kupeleka uthenga wakuneneska na watsopano, nga ni zina, foni, email, emergency contact, driver details, vehicle details, traveler details na payment information para vikukhumbikwa.",
          "Muli na udindo wakusunga password, OTP, boarding code na akaunti mwakuvikilirika. Tingayimika panji kujala akaunti iyo yili na uthenga wautesi, wambura kukwana, wakukayikiska, wambura chivikiliro panji wambura kuzomerezgeka.",
        ],
      },
      {
        title: "4. Udindo wa madalaivala",
        body: [
          "Madalaivala ŵakwenera kusindikiza maulendo agho ŵakukhumba kuchita nadi ndipo ŵakwenera kupeleka route, stops, nyengo, mipando, fare, vehicle, pickup na drop-off vyaunenesko.",
          "Driver wali na udindo wa galimoto yiwemi, documents zakuzomerezgeka, insurance para yikukhumbikwa, driving yakuvikilirika, seat limits, kusamalira wakwera na kulondezga traffic na transport laws.",
          "Driver wangapemphanga ndalama zambura kuzomerezgeka yayi, wangajumphanga platform payment yayi, wangagwiliskiranga ntchito viheni uthenga wa wakwera yayi, wangazuzanga galimoto yayi, wangasuzganga users yayi, panji kuzomerezga wakwera wambura verification kukwera.",
        ],
      },
      {
        title: "5. Udindo wa wakwera",
        body: [
          "Wakwera ŵakwenera kupeleka booking, traveler, emergency contact, pickup, drop-off na payment information yaunenesko. Usange mukusungira ŵanyinu, mukusimikizga kuti muli na mazaza ghakupeleka uthenga wawo.",
          "Wakwera ŵakwenera kufika pa nyengo, kulondezga ulongozgi wa chivikiliro, kusunga boarding code, na kupeleka code kwa driver wakwenelera pa nyengo yakukwera.",
          "Wakwera ŵangachimbiranga malipiro yayi, kupanga disputes zautesi yayi, kunanga galimoto yayi, kusuzga ŵanthu yayi, kunyamura vinthu vyambura kuzomerezgeka panji vyakofya yayi, panji kugwiliskira ntchito akaunti/payment ya munthu munyake kwambura mazaza.",
        ],
      },
      {
        title: "6. Booking, routes, mipando na nyengo",
        body: [
          "Booking yikuthemba mipando iyo yilipo, payment confirmation, route availability, driver approval para yikukhumbikwa, na platform checks. Trip iyo yawoneka pa list yikung'anamura seat confirmed yayi mpaka booking flow yamalizgika.",
          "Routes, stops, times, fares, vehicles na seats vingasintha chifukwa cha driver updates, misewu, weather, police checks, delays, breakdowns, safety issues, cancellations panji operational reasons.",
          "ChepetsaRide yingasunga mpando kwa kanyengo apo payment yikuchitika. Reservation yingamara panji kufumiskika usange payment yindamale panji verification yatondeka.",
        ],
      },
      {
        title: "7. Malipiro, fees, payouts na refunds",
        body: [
          "Malipiro ghakuchitika kwizira mu third-party providers ŵakuzomerezgeka. Mukuzomerezga ChepetsaRide na providers ŵake kuchita payments, fees, refunds, reversals, settlements na payout checks zakukhwaskana na ntchito yinu.",
          "Ndalama zingasazgapo fare, platform fees, provider charges, convenience fees, payout costs, taxes panji charges zinyake. Drivers ŵakulandira payout pekha para checks zakukhumbikwa zachitika nga payment confirmation, boarding verification, trip status, dispute status, refund status na fraud review.",
          "Cancellation na refund eligibility vikuthemba booking status, payment status, trip status, boarding verification, timing, driver action, passenger action, provider confirmation na platform rules. Refund yingachepeskeka na fees na costs zakukhumbikwa.",
          "Refund yikumalizgika chifukwa cha request panji webhook pera yayi. Tingasimikizga payout status na payment provider pambere tindamarke refund complete, cancel booking, kuwezga seats panji kusintha wallet/payment records.",
        ],
      },
      {
        title: "8. Chivikiliro, khalidwe na vinthu vyakukanizgika",
        body: [
          "Mukwenera kugwiliskira ntchito ChepetsaRide mwamalango na mwauchindami. Mungayigwiliskiranga ntchito pa fraud, money laundering, illegal transport, harassment, threats, discrimination, impersonation, false documents, spam, security attacks panji bypassing platform fees yayi.",
          "Driver verification, vehicle review, ratings, boarding codes, payment checks na account checks vikuchepeska risk kweni vikupanga guarantee yayi kuti user, vehicle, route, trip panji transaction vilije risk.",
          "Pa emergency, mukwenera kuphalira emergency services panji local authorities dankha. ChepetsaRide ni emergency response service yayi.",
        ],
      },
      {
        title: "9. Data, content, disputes na enforcement",
        body: [
          "Tikusonkhaniska na kugwiliskira ntchito account, trip, booking, payment, device, verification, support na communication data kuti nsanja yigwire ntchito, transactions zichitike, fraud yikanizgike, users ŵawovwirike, rules zilondezgeke na legal obligations zikwaniliskike.",
          "Muli na udindo pa content iyo mukutumiza nga documents, photos, listings, messages, ratings na comments. Tingasunga, kuwonetsa, kusintha, kuchotsa panji kugawana content para yikukhumbikwa pa operations, safety, support, disputes, law panji enforcement.",
          "Pa disputes, tingawona booking records, payment records, refund records, payout records, boarding code activity, messages, reports na provider responses. Tingapanga decisions potengera uthenga uwo ulipo.",
        ],
      },
      {
        title: "10. Liability, suspension na governing law",
        body: [
          "Malinga na umo malango ghakuzomerezgera, ChepetsaRide yilije udindo pa indirect losses, missed trips, delays, breakdowns, road incidents, user conduct, third-party payment issues panji data loss.",
          "ChepetsaRide yilije udindo pa vyakuchita, kuleka kuchita, driving, vehicle condition, route choices, delays, cancellations, communications panji conduct ya drivers, passengers panji third parties.",
          "Tingayimika, kuchepeska panji kujala access para user waswa Malango agha, wapanga risk, wapeleka uthenga wautesi, wagwiliskira ntchito viheni payments/refunds, wapweteka users panji waika platform pa legal, financial panji reputational risk.",
          "Malango agha ghakulondezga laws za Malawi para mandatory law yinyake yindayowoye vinyake. Mafumbo panji disputes ghakwenera kwamba na ChepetsaRide support.",
        ],
      },
    ],
  },
};

function TermsPage() {
  const { language } = useI18n();
  const content = termsContent[language] ?? termsContent.en;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:py-16">
      <PageHeader
        eyebrow={content.eyebrow}
        title={content.title}
        description={content.description}
      />

      <div className="mt-6 rounded-md border border-border bg-card p-4 text-sm text-muted-foreground sm:p-5">
        <p>
          <span className="font-medium text-foreground">{content.updated}</span>{" "}
          {content.legalNote}
        </p>
      </div>

      <div className="mt-8 space-y-5">
        {content.sections.map((section) => (
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
