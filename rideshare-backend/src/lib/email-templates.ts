const BRAND_COLOR = "#16a34a"; // green-600
const BRAND_COLOR_DARK = "#15803d"; // green-700
const TEXT_COLOR = "#1e293b"; // slate-800
const MUTED_COLOR = "#64748b"; // slate-500
const BG_COLOR = "#f8fafc"; // slate-50
const CARD_BG = "#ffffff";
const BORDER_COLOR = "#e2e8f0"; // slate-200

const DOUBLE_QUOTE_ENTITY = "\u0026quot;";
const AMPERSAND_ENTITY = "\u0026amp;";
const LESS_THAN_ENTITY = "\u0026lt;";
const GREATER_THAN_ENTITY = "\u0026gt;";

function escapeHtml(text: string) {
  return text
    .replace(/&/g, AMPERSAND_ENTITY)
    .replace(/</g, LESS_THAN_ENTITY)
    .replace(/>/g, GREATER_THAN_ENTITY)
    .replace(/"/g, DOUBLE_QUOTE_ENTITY);
}

function baseTemplate(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:${BG_COLOR};font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG_COLOR};padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:${CARD_BG};border-radius:12px;overflow:hidden;border:1px solid ${BORDER_COLOR};">
          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND_COLOR};padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">RideShare</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Safe, reliable rides across Malawi</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid ${BORDER_COLOR};text-align:center;">
              <p style="margin:0;color:${MUTED_COLOR};font-size:12px;line-height:1.6;">
                This is an automated message from RideShare.<br>
                If you did not expect this email, please contact info@chepetsaride.com.
              </p>
              <p style="margin:8px 0 0;color:${MUTED_COLOR};font-size:12px;">
                &copy; ${new Date().getFullYear()} RideShare. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Renders a key-value details table for booking/trip info */
function detailsTable(rows: Array<{ label: string; value: string }>): string {
  const cells = rows
    .map(
      (row) => `
      <tr>
        <td style="padding:8px 0;color:${MUTED_COLOR};font-size:14px;width:140px;vertical-align:top;">${escapeHtml(row.label)}</td>
        <td style="padding:8px 0;color:${TEXT_COLOR};font-size:14px;font-weight:600;">${escapeHtml(row.value)}</td>
      </tr>`,
    )
    .join("");
  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0;">${cells}</table>`;
}

function highlightBox(content: string): string {
  return `<div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">${content}</div>`;
}

function greeting(name: string): string {
  return `<p style="margin:0 0 16px;color:${TEXT_COLOR};font-size:16px;line-height:1.6;">Hi ${escapeHtml(name || "there")},</p>`;
}

// ─── Template Functions ───────────────────────────────────

export function bookingConfirmationEmail(params: {
  passengerName: string;
  route: string;
  departureLabel: string;
  customerAmount: string;
  bookingId: string;
  txRef: string;
}) {
  const body = `
    ${greeting(params.passengerName)}
    <p style="margin:0 0 8px;color:${TEXT_COLOR};font-size:16px;line-height:1.6;">Your payment was successful and your <strong>ride booking is confirmed</strong>.</p>
    ${detailsTable([
      { label: "Route", value: params.route },
      { label: "Departure", value: params.departureLabel },
      { label: "Amount paid", value: `MWK ${params.customerAmount}` },
      { label: "Booking ID", value: params.bookingId },
      { label: "Transaction ref", value: params.txRef },
    ])}
    <div style="background-color:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 16px;margin:16px 0;">
      <p style="margin:0;color:#c2410c;font-size:14px;font-weight:600;">Your boarding code has been sent separately via SMS.</p>
      <p style="margin:4px 0 0;color:#9a3412;font-size:13px;">Share it <strong>only</strong> with your driver at the boarding point.</p>
    </div>
    <p style="margin:16px 0 0;color:${MUTED_COLOR};font-size:14px;">Thank you for choosing RideShare!</p>
  `;
  return baseTemplate(body);
}

export function driverBookingNotificationEmail(params: {
  driverName: string;
  passengerName: string;
  route: string;
  departureLabel: string;
  fareAmount: string;
  driverAmount: string;
  bookingId: string;
  txRef: string;
}) {
  const body = `
    ${greeting(params.driverName)}
    <p style="margin:0 0 8px;color:${TEXT_COLOR};font-size:16px;line-height:1.6;">A passenger has successfully paid and <strong>booked your ride</strong>.</p>
    ${detailsTable([
      { label: "Passenger", value: params.passengerName },
      { label: "Route", value: params.route },
      { label: "Departure", value: params.departureLabel },
      { label: "Fare", value: `MWK ${params.fareAmount}` },
      { label: "Your earnings", value: `MWK ${params.driverAmount}` },
      { label: "Booking ID", value: params.bookingId },
      { label: "Transaction ref", value: params.txRef },
    ])}
    <div style="background-color:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 16px;margin:16px 0;">
      <p style="margin:0;color:#c2410c;font-size:14px;font-weight:600;">Confirm the passenger at boarding using their boarding code.</p>
    </div>
  `;
  return baseTemplate(body);
}

export function driverApprovedEmail(params: {
  driverName: string;
  message: string;
}) {
  const body = `
    ${greeting(params.driverName)}
    <p style="margin:0 0 8px;color:${TEXT_COLOR};font-size:16px;line-height:1.6;">Great news — your <strong>driver profile has been approved</strong>!</p>
    <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;color:${TEXT_COLOR};font-size:14px;line-height:1.6;">${escapeHtml(params.message)}</p>
    </div>
    <p style="margin:16px 0 0;color:${MUTED_COLOR};font-size:14px;">You can now start accepting passengers. Log in to your dashboard to manage trips.</p>
  `;
  return baseTemplate(body);
}

export function driverChangesNeededEmail(params: {
  driverName: string;
  message: string;
}) {
  const body = `
    ${greeting(params.driverName)}
    <p style="margin:0 0 8px;color:${TEXT_COLOR};font-size:16px;line-height:1.6;">Your driver profile <strong>requires some changes</strong> before it can be approved.</p>
    <div style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;color:${TEXT_COLOR};font-size:14px;line-height:1.6;">${escapeHtml(params.message)}</p>
    </div>
    <p style="margin:16px 0 0;color:${MUTED_COLOR};font-size:14px;">Please log in to your dashboard and update the required information, then resubmit for review.</p>
  `;
  return baseTemplate(body);
}

export function withdrawalCodeEmail(params: {
  code: string;
  ttlMinutes: number;
}) {
  const body = `
    ${greeting("Driver")}
    <p style="margin:0 0 8px;color:${TEXT_COLOR};font-size:16px;line-height:1.6;">Use the code below to <strong>confirm your withdrawal</strong>.</p>
    ${highlightBox(`<span style="font-size:32px;font-weight:800;letter-spacing:6px;color:${BRAND_COLOR_DARK};">${escapeHtml(params.code)}</span>`)}
    <p style="margin:8px 0 0;color:${MUTED_COLOR};font-size:13px;text-align:center;">Valid for ${params.ttlMinutes} minutes &bull; Do not share this code</p>
  `;
  return baseTemplate(body);
}

export function verificationCodeEmail(params: {
  code: string;
  ttlMinutes: number;
}) {
  const body = `
    ${greeting("there")}
    <p style="margin:0 0 8px;color:${TEXT_COLOR};font-size:16px;line-height:1.6;">Use this code to <strong>verify your account</strong> on RideShare.</p>
    ${highlightBox(`<span style="font-size:32px;font-weight:800;letter-spacing:6px;color:${BRAND_COLOR_DARK};">${escapeHtml(params.code)}</span>`)}
    <p style="margin:8px 0 0;color:${MUTED_COLOR};font-size:13px;text-align:center;">Valid for ${params.ttlMinutes} minutes &bull; Do not share this code</p>
  `;
  return baseTemplate(body);
}

export function adminCustomEmail(params: {
  subject: string;
  message: string;
}) {
  const body = `
    ${greeting("there")}
    <p style="margin:0 0 8px;color:${TEXT_COLOR};font-size:16px;line-height:1.6;">${escapeHtml(params.message).replace(/\n/g, "<br>")}</p>
  `;
  return baseTemplate(body);
}

/** Build a plain-text fallback from the same data, for email clients that don't render HTML */
export function bookingConfirmationText(params: Parameters<typeof bookingConfirmationEmail>[0]): string {
  return `Hi ${params.passengerName},\n\nYour payment was successful and your ride booking is confirmed.\n\nRoute: ${params.route}\nDeparture: ${params.departureLabel}\nAmount paid: MWK ${params.customerAmount}\nBooking ID: ${params.bookingId}\nTransaction ref: ${params.txRef}\n\nYour boarding code has been sent separately. Share it only with your driver at the boarding point.\n\nThank you for using RideShare.`;
}

export function driverBookingNotificationText(params: Parameters<typeof driverBookingNotificationEmail>[0]): string {
  return `Hi ${params.driverName},\n\nA passenger has successfully paid and booked your ride.\n\nPassenger: ${params.passengerName}\nRoute: ${params.route}\nDeparture: ${params.departureLabel}\nFare: MWK ${params.fareAmount}\nDriver amount after fees: MWK ${params.driverAmount}\nBooking ID: ${params.bookingId}\nTransaction ref: ${params.txRef}\n\nPlease confirm the passenger at boarding using their boarding code.`;
}

export function driverApprovedText(params: Parameters<typeof driverApprovedEmail>[0]): string {
  return `Hi ${params.driverName},\n\nGreat news — your driver profile has been approved! 🎉\n\n${params.message}\n\nYou can now start accepting passengers. Log in to your dashboard to manage trips.`;
}

export function driverChangesNeededText(params: Parameters<typeof driverChangesNeededEmail>[0]): string {
  return `Hi ${params.driverName},\n\nYour driver profile requires some changes before it can be approved.\n\n${params.message}\n\nPlease log in to your dashboard and update the required information, then resubmit for review.`;
}

export function withdrawalCodeText(params: Parameters<typeof withdrawalCodeEmail>[0]): string {
  return `Your RideShare withdrawal code is ${params.code}. Valid for ${params.ttlMinutes} minutes. Do not share this code.`;
}

export function verificationCodeText(params: Parameters<typeof verificationCodeEmail>[0]): string {
  return `Your RideShare verification code is ${params.code}. Valid for ${params.ttlMinutes} minutes. Do not share this code.`;
}

export function adminCustomText(params: Parameters<typeof adminCustomEmail>[0]): string {
  return params.message;
}
export function passwordResetCodeEmail(params: { name: string; code: string; ttlMinutes: number }) {
  const body = `
    ${greeting(params.name)}
    <p style="margin:0 0 8px;color:${TEXT_COLOR};font-size:16px;line-height:1.6;">Use this code to reset your RideShare password.</p>
    ${highlightBox(`<div style="color:${BRAND_COLOR_DARK};font-size:32px;font-weight:800;letter-spacing:6px;font-family:monospace;">${escapeHtml(params.code)}</div>`)}
    <p style="margin:16px 0 0;color:${MUTED_COLOR};font-size:14px;">This code expires in ${params.ttlMinutes} minutes. If you did not request a password reset, ignore this email.</p>
  `;
  return baseTemplate(body);
}

export function passwordResetCodeText(params: { code: string; ttlMinutes: number }) {
  return `Your RideShare password reset code is ${params.code}. It expires in ${params.ttlMinutes} minutes.`;
}
