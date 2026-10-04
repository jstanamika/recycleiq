const CLEAN_LOGO_URL = '/icons/recycleiq-official.png';
export const logoMark = () => `<img class="logo-image" src="${CLEAN_LOGO_URL}" alt="" aria-hidden="true" />`;
export function renderBrandMarks(){ document.querySelectorAll('#brand-mark,#splash-mark').forEach(el=>{ el.innerHTML=logoMark(); el.style.background='transparent'; el.style.boxShadow='none'; el.style.border='0'; }); }
