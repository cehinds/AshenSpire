import { OpenConfirmationModal } from './confirmationModal.js';
import { t } from '../strings.js';

// Purchases always ask, independently of hold-to-confirm accessibility settings.
// The caller retains its displayed quote and revalidates it in the transaction.
export function confirmMerchantPurchase({ name, price, opener, onConfirm, onCancel = () => {} }) {
  return OpenConfirmationModal({
    title: t('shop.purchase.confirm'), target: name,
    message: t('shop.purchase.message', { price }),
    confirmLabel: t('shop.book.buy'), cancelLabel: t('common.back'),
    returnFocusElement: opener, onConfirm, onCancel,
  });
}

export function confirmMerchantCardSale({ name, quantity, price, opener, onConfirm, onCancel = () => {} }) {
  return OpenConfirmationModal({
    title: t('shop.sale.confirm'), target: name,
    message: t('shop.sale.message', { quantity, price }),
    confirmLabel: t('shop.bar.sell'), cancelLabel: t('common.back'),
    returnFocusElement: opener, onConfirm, onCancel,
  });
}
