// import {
//   btnLink,
//   heading,
//   labeledValue,
//   paragraph,
//   section,
// } from "./helpers";


// export function stripePaymentSuccessToAdmin(input: {
//   customerName: string;
//   customerEmail: string;
//   packageName: string;
//   packagePrice: number;
//   currency?: string;
// }): string {
//   const customerName = input.customerName.trim() || "Unknown customer";
//   const customerEmail = input.customerEmail.trim() || "unknown";
//   const packageName = input.packageName.trim() || "Unknown package";
//   const amount = input.packagePrice.toString();

//   return `
//   ${heading("New package purchase")}
//   ${paragraph("Hi Admin,")}
//   ${paragraph(
//     "A customer has successfully completed a Stripe payment on Skill Bridge. Details below:",
//   )}

//   ${section(
//     "Purchase details",
//     `
//     ${labeledValue("Customer name", customerName)}
//     ${labeledValue("Customer email", customerEmail)}
//     ${labeledValue("Package", packageName)}
//     ${labeledValue("Amount paid", amount)}
//     `,
//   )}

//   ${btnLink(`mailto:${customerEmail}`, "Email customer", "primary")}

//   ${paragraph("This is an automated notification from Skill Bridge.")}
//   `;
// }
