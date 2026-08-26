import React from 'react';
import { HowItWorksModal } from './InfoModals';

interface RulesProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Rules: React.FC<RulesProps> = ({ isOpen = true, onClose = () => {} }) => {
  return <HowItWorksModal isOpen={isOpen} onClose={onClose} />;
};

export default Rules;
