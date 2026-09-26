export const formatEnglishDateTime = (dateVal: string | Date | number): string => {
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '—';

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // '0' becomes '12'
  const hh = String(hours).padStart(2, '0');

  return `${yyyy}/${mm}/${dd} • ${hh}:${minutes} ${ampm}`;
};

