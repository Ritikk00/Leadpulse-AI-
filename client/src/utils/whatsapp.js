export function formatWhatsAppPhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) digits = `91${digits}`;
  return /^\d{8,15}$/.test(digits) ? digits : '';
}

export function openLeadWhatsApp(lead) {
  const phone = formatWhatsAppPhone(lead.phone);
  if (!phone) return false;
  const message = encodeURIComponent(lead.suggestedWhatsAppMessage || 'Hello...');
  window.open(`https://wa.me/${phone}?text=${message}`, '_blank', 'noopener,noreferrer');
  return true;
}
