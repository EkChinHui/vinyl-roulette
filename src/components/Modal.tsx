import { useEffect, useState } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Small delay to trigger animation
      setTimeout(() => setIsAnimating(true), 10);
    } else if (isVisible) {
      // Trigger exit animation
      setIsAnimating(false);
      // Wait for animation to complete before unmounting
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isVisible]);

  if (!isVisible) return null;

  return (
    <div
      className={`modal-overlay ${isAnimating ? 'modal-enter' : 'modal-exit'}`}
      onClick={onClose}
    >
      <div
        className={`modal-content ${isAnimating ? 'modal-enter' : 'modal-exit'}`}
        onClick={e => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>×</button>
        {children}
      </div>
    </div>
  );
};

export default Modal; 