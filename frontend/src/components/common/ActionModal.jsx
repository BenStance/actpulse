import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

export default function ActionModal({
  open,
  title,
  description,
  dirty = false,
  onClose,
  onConfirm,
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  confirmDisabled = false,
  loading = false,
  size = 'lg',
  children,
}) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Reset discard prompt when modal closes
  useEffect(() => {
    if (open) return undefined;
    const timer = setTimeout(() => setConfirmDiscard(false), 0);
    return () => clearTimeout(timer);
  }, [open]);

  const handleClose = () => {
    if (dirty) setConfirmDiscard(true);
    else onClose?.();
  };

  const handleDiscard = () => {
    setConfirmDiscard(false);
    onClose?.();
  };

  return (
    <>
      <Modal
        open={open}
        title={title}
        description={description}
        size={size}
        onClose={handleClose}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              {cancelLabel}
            </Button>
            {onConfirm && (
              <Button
                variant={confirmVariant}
                onClick={onConfirm}
                loading={loading}
                disabled={confirmDisabled}
              >
                {confirmLabel}
              </Button>
            )}
          </div>
        }
      >
        {children}
      </Modal>

      {/* Discard confirmation */}
      <Modal
        open={open && confirmDiscard}
        title="Discard unsaved changes?"
        onClose={() => setConfirmDiscard(false)}
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setConfirmDiscard(false)}>
              Keep Editing
            </Button>
            <Button variant="danger" onClick={handleDiscard}>
              Discard Changes
            </Button>
          </div>
        }
      >
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-500/10">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            You have unsaved changes in this form. If you leave now, they will be lost.
          </p>
        </div>
      </Modal>
    </>
  );
}
