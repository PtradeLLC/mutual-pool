import React from 'react';
import { useCountry } from '../context/CountryContext';

// The company behind MutualPool in the visitor's country, as shown in the
// copyright lines. Linked to the company's site when the country config has one.
export const LegalEntityName: React.FC = () => {
  const { country } = useCountry();
  const { legalEntityName, legalEntityUrl } = country.regulations;
  if (!legalEntityUrl) return <>{legalEntityName}</>;
  return (
    <a href={legalEntityUrl} target="_blank" rel="noopener noreferrer" className="hover:text-[#005FB8] hover:underline transition-colors">
      {legalEntityName}
    </a>
  );
};
