// Turns Urdu-script or Devanagari speech text into Roman Urdu, and gives a "sound key" for fuzzy matching.
// Shared by the browser (to show what was heard) and the server (to understand it). No DOM use here.

const UR_WORDS = {
  'کو': 'ko', 'سے': 'se', 'کا': 'ka', 'کی': 'ki', 'کے': 'ke', 'نے': 'ne', 'میں': 'mein', 'اور': 'aur', 'پر': 'par',
  'دیا': 'diya', 'دیے': 'diye', 'دئیے': 'diye', 'دی': 'di', 'بیچا': 'becha', 'بھیجا': 'bheja', 'ملا': 'mila', 'ملے': 'mile', 'ملی': 'mili', 'آئے': 'aaye', 'آیا': 'aaya',
  'خریدا': 'kharida', 'خریدے': 'kharide', 'لیا': 'liya', 'لیے': 'liye', 'منگوایا': 'mangwaya', 'وصول': 'wasool', 'جمع': 'jama', 'ادا': 'ada', 'ادائیگی': 'adaigi',
  'کیش': 'cash', 'نقد': 'naqad', 'ادھار': 'udhaar', 'ادہار': 'udhaar', 'بقایا': 'baqi', 'باقی': 'baqi', 'بینک': 'bank', 'آن لائن': 'online', 'چیک': 'cheque',
  'خرچہ': 'kharcha', 'خرچ': 'kharch', 'کرایہ': 'kiraya', 'پیٹرول': 'petrol', 'ڈیزل': 'diesel', 'تنخواہ': 'tankhwah', 'بجلی': 'bijli', 'چائے': 'chai', 'کھانا': 'khana', 'بھاڑا': 'bhara', 'مزدوری': 'mazdoori',
  'ریٹ': 'rate', 'روپے': 'rupay', 'روپیہ': 'rupay', 'فی': 'per', 'کلو': 'kilo', 'گرام': 'gram', 'پیس': 'pcs', 'دانے': 'dana', 'کارٹن': 'carton', 'ڈبہ': 'dabba', 'ڈبے': 'dabbe', 'پیٹی': 'peti', 'درجن': 'darjan', 'لیٹر': 'litre', 'پیکٹ': 'packet',
  'ایک': 'ek', 'دو': 'do', 'تین': 'teen', 'چار': 'char', 'پانچ': 'panch', 'چھ': 'che', 'سات': 'saat', 'آٹھ': 'aath', 'نو': 'nau', 'دس': 'das', 'بیس': 'bees', 'پچیس': 'pachees', 'تیس': 'tees', 'چالیس': 'chalees', 'پچاس': 'pachas',
  'آدھا': 'adha', 'ڈیڑھ': 'dedh', 'ڈھائی': 'dhai', 'سو': 'sau', 'ہزار': 'hazar', 'لاکھ': 'lakh',
  'گھی': 'ghee', 'مکھن': 'makhan', 'بٹر': 'butter', 'پنیر': 'paneer', 'کریم': 'cream', 'دودھ': 'doodh', 'دہی': 'dahi', 'مایونیز': 'mayonnaise', 'ہوٹل': 'hotel', 'بیکرز': 'bakers', 'بیکری': 'bakery', 'ڈیری': 'dairy', 'ٹریڈرز': 'traders', 'ریسٹورنٹ': 'restaurant', 'اسٹور': 'store', 'سٹور': 'store',
};
const UR_CH = { 'ا': 'a', 'آ': 'aa', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ٹ': 't', 'ث': 's', 'ج': 'j', 'چ': 'ch', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ڈ': 'd', 'ذ': 'z', 'ر': 'r', 'ڑ': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ک': 'k', 'ك': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ں': 'n', 'و': 'o', 'ہ': 'h', 'ھ': 'h', 'ۂ': 'h', 'ة': 'h', 'ء': '', 'ی': 'i', 'ي': 'i', 'ے': 'e', 'ئ': 'i', 'ؤ': 'o', 'أ': 'a', 'إ': 'i', 'ٰ': 'a', 'َ': 'a', 'ِ': 'i', 'ُ': 'u', 'ّ': '', 'ْ': '' };
const DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9', '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9', '،': ',', '۔': '.' };

// Devanagari (what Google returns for Hindi/Urdu speech in hi-IN)
const DV_V = { 'अ': 'a', 'आ': 'a', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u', 'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o' };
const DV_M = { 'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ॅ': 'e' };
const DV_C = { 'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n', 'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n', 'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h', 'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f', 'य़': 'y' };
const NUKTA = { 'क': 'q', 'ख': 'kh', 'ग': 'gh', 'ज': 'z', 'ड': 'r', 'ढ': 'rh', 'फ': 'f' };

function devanagari(word) {
  let out = '', i = 0; const ch = [...word.normalize('NFC')];
  while (i < ch.length) {
    let c = ch[i];
    if (DV_V[c]) { out += DV_V[c]; i++; continue; }
    if (DV_C[c] || NUKTA[c]) {
      let cons = DV_C[c];
      if (ch[i + 1] === '़') { cons = NUKTA[c] || cons; i++; }
      const nx = ch[i + 1];
      if (nx === '्') { out += cons; i += 2; continue; }
      if (nx && DV_M[nx]) { out += cons + DV_M[nx]; i += 2; continue; }
      // inherent "a", dropped at the end of a word (schwa deletion)
      out += cons + (i + 1 < ch.length && !/[ंँः]/.test(nx || '') ? 'a' : (/[ंँ]/.test(nx || '') ? 'a' : '')); i++; continue;
    }
    if (c === 'ं' || c === 'ँ') { out += 'n'; i++; continue; }
    if (c === 'ः') { out += 'h'; i++; continue; }
    if (DV_M[c]) { out += DV_M[c]; i++; continue; }
    out += /[ऀ-ॿ]/.test(c) ? '' : c; i++;
  }
  return out.replace(/aa+/g, 'a');
}
function urdu(word) {
  if (UR_WORDS[word]) return UR_WORDS[word];
  let s = '';
  for (const c of word) s += UR_CH[c] ?? (/[؀-ۿ]/.test(c) ? '' : c);
  return s.replace(/^o/, 'u').replace(/oo+/g, 'o').replace(/ii+/g, 'i').replace(/aa+/g, 'a');
}

// Common words as Google spells them in Hindi/Urdu script, mapped back to the words the app understands
const FIX = { kaish: 'cash', kash: 'cash', kesh: 'cash', kaesh: 'cash', ret: 'rate', reit: 'rate', ghi: 'ghee', hotal: 'hotel', hotl: 'hotel', rupaye: 'rupay', rupye: 'rupay', rupe: 'rupay', rupee: 'rupay', rupees: 'rupay',
  karton: 'carton', kartan: 'carton', kartun: 'carton', baink: 'bank', bainka: 'bank', onalain: 'online', onlain: 'online', chek: 'cheque', dijal: 'diesel', dizal: 'diesel', disal: 'diesel', pis: 'pcs', pies: 'pcs', pis: 'pcs',
  litar: 'litre', pekat: 'packet', paikat: 'packet', paiket: 'packet', grama: 'gram', hajar: 'hazar', hazaar: 'hazar', hijar: 'hazar', lakha: 'lakh', lac: 'lakh', kilogram: 'kilo', kilogrem: 'kilo', kilu: 'kilo',
  pachas: 'pachas', pachaas: 'pachas', bis: 'bees', tis: 'tees', das: 'das', sau: 'sau', udhar: 'udhaar', udhara: 'udhaar', kharacha: 'kharcha', kharch: 'kharch', bekars: 'bakers', bekarz: 'bakers', bekari: 'bakery', deyari: 'dairy', deri: 'dairy',
  restorent: 'restaurant', restaurent: 'restaurant', traiders: 'traders', tredars: 'traders', stor: 'store', mayonez: 'mayonnaise', meyonez: 'mayonnaise', mayonij: 'mayonnaise', paneera: 'paneer', krim: 'cream', kreem: 'cream' };

/** Any script -> Roman Urdu, lowercase */
export function romanize(text) {
  let s = String(text || '').replace(/./gu, c => DIGITS[c] ?? c);
  // two-word Urdu phrases first
  s = s.replace(/آن لائن/g, ' online ');
  return s.split(/(\s+)/).map(w => {
    if (/[ऀ-ॿ]/.test(w)) return devanagari(w);
    if (/[؀-ۿ]/.test(w)) return w.split(/([^؀-ۿ]+)/).map(p => (/[؀-ۿ]/.test(p) ? urdu(p) : p)).join('');
    return w;
  }).join('').toLowerCase().replace(/[a-z]+/g, w => FIX[w] || w);
}

/** Sound key: consonant skeleton, so "batar" ~ "butter", "hotal" ~ "hotel", "mayonese" ~ "mayonnaise" */
export function soundKey(w) {
  let s = String(w || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!s) return '';
  s = s.replace(/ph/g, 'f').replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/sh/g, 's').replace(/ch/g, 'c').replace(/th/g, 't').replace(/dh/g, 'd').replace(/bh/g, 'b').replace(/jh/g, 'j')
    .replace(/ck/g, 'k').replace(/q/g, 'k').replace(/c/g, 'k').replace(/z/g, 'j').replace(/v/g, 'w').replace(/x/g, 'ks');
  const first = s[0];
  s = first + s.slice(1).replace(/[aeiouyhw]/g, '');
  return s.replace(/(.)\1+/g, '$1');
}
