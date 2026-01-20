import React from 'react';
import { Modal } from '../common/Modal';

interface TokenCreationFormProps {
  isOpen: boolean;
  onClose: () => void;
  onTokenCreated?: () => Promise<void>;
}

export function TokenCreationForm({ isOpen, onClose }: TokenCreationFormProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Token">
      <div style={{ textAlign: 'center', padding: '32px' }}>
        <h3>Coming Soon</h3>
        <p className="muted" style={{ marginTop: '16px' }}>
          Token creation on SUI is under development.
        </p>
        <button className="btn ghost" onClick={onClose} style={{ marginTop: '24px' }}>
          Close
        </button>
      </div>
    </Modal>
  );
}

export default TokenCreationForm;
