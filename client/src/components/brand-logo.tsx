interface BrandLogoProps {
  className?: string;
  darkBackground?: boolean;
}

export function BrandLogo({ className = "h-10 w-auto", darkBackground = false }: BrandLogoProps) {
  const src = darkBackground ? "/learnpedia-logo-dark.png" : "/learnpedia-logo.png";
  return <img src={src} alt="Learnpedia" className={className} />;
}
