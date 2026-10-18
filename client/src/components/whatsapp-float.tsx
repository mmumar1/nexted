import { FaWhatsapp } from "react-icons/fa";

const whatsappLink = "https://wa.me/2349030578183?text=Hello%2C%20I%20would%20like%20to%20know%20more%20about%20Learnpedia.";

export function WhatsAppFloat() {
  return (
    <a
      href={whatsappLink}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Message Learnpedia on WhatsApp"
      title="Message us on WhatsApp"
      className="fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 hover:bg-[#20bd5a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:bottom-6 sm:right-6"
    >
      <FaWhatsapp aria-hidden="true" className="h-8 w-8" />
      <span className="sr-only">Message us on WhatsApp</span>
    </a>
  );
}
