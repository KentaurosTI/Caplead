const puppeteer = require('puppeteer');
const crud = require('./crud');
const { getBrowserPath } = require('./browserPath');

/**
 * Busca recursivamente emails e telefones na string providenciada ou tags mailto/tel.
 */
function searchPatterns(text = '', html = '') {
  const safeDecode = (value = '') => {
    try { return decodeURIComponent(value); } catch (_) { return value; }
  };

  const normalizePhone = (value = '') => {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
    return digits;
  };

  const isLikelyBrazilPhone = (value = '') => {
    const digits = normalizePhone(value);
    if (digits.length < 8 || digits.length > 11) return false;
    if (digits.length === 8 && /^(19|20)\d{6}$/.test(digits)) return false;
    return true;
  };

  const addPhone = (collection, value) => {
    const digits = normalizePhone(value);
    if (isLikelyBrazilPhone(digits)) collection.push(digits);
  };

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const phoneRegex = /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\d{4}[-\s]?\d{4}|\d{4}[-\s]?\d{4})/g;
  const compactPhoneRegex = /(?:\+?55)?\d{10,11}/g;
  const searchable = [text, html, safeDecode(html)].join('\n');

  let emails = [...new Set(searchable.match(emailRegex) || [])].filter(email => {
    const lower = email.toLowerCase();
    return !lower.endsWith('.png') && !lower.endsWith('.jpg') && !lower.endsWith('.jpeg') && !lower.endsWith('.webp') && !lower.endsWith('.gif') && !lower.endsWith('.svg');
  });

  let phones = [];
  (searchable.match(phoneRegex) || []).forEach(phone => addPhone(phones, phone));
  (searchable.match(compactPhoneRegex) || []).forEach(phone => addPhone(phones, phone));

  const mailtoMatches = searchable.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi);
  if (mailtoMatches) {
    mailtoMatches.forEach(match => emails.push(safeDecode(match.replace(/mailto:/i, '').split('?')[0])));
  }

  const telMatches = searchable.match(/tel:([^\s"'<>]+)/gi);
  if (telMatches) {
    telMatches.forEach(match => addPhone(phones, safeDecode(match.replace(/tel:/i, ''))));
  }

  const whatsappPatterns = [
    /(?:https?:\/\/)?(?:www\.)?wa\.me\/(?:55)?(\d{10,11})/gi,
    /(?:https?:\/\/)?(?:api\.|web\.)?whatsapp\.com\/send\?[^"'<>]*?phone=(?:55)?(\d{10,11})/gi,
    /whatsapp:\/\/send\?[^"'<>]*?phone=(?:55)?(\d{10,11})/gi,
    /(?:href|data-href|data-url|onclick)=["'][^"']*(?:wa\.me|whatsapp)[^"']*(?:55)?(\d{10,11})[^"']*["']/gi
  ];
  whatsappPatterns.forEach(regex => {
    let match;
    while ((match = regex.exec(searchable)) !== null) addPhone(phones, match[1]);
  });

  emails = [...new Set(emails.map(email => email.trim().replace(/^mailto:/i, '').split('?')[0]).filter(Boolean))];
  phones = [...new Set(phones.map(normalizePhone).filter(isLikelyBrazilPhone))];

  return {
    email: emails[0] || null,
    telefone: phones[0] || null,
    emails,
    telefones: phones
  };
}

async function extractPublicContact(leadId, url) {
  let browser;
  try {
    const executablePath = getBrowserPath();
    const formattedUrl = url.startsWith('http') ? url : `http://${url}`;
    
    browser = await puppeteer.launch({ 
      headless: 'new', 
      executablePath: executablePath || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    const page = await browser.newPage();
    const tryGoto = async (targetUrl, timeout) => {
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout });
    };

    const collectSignals = async () => {
      const textContent = await page.evaluate(() => {
        const visibleText = document.body ? document.body.innerText : '';
        const linkSignals = Array.from(document.querySelectorAll('a[href], button, [onclick], [aria-label], [title], [data-href], [data-url]'))
          .map(el => [
            el.innerText,
            el.getAttribute('href'),
            el.getAttribute('onclick'),
            el.getAttribute('aria-label'),
            el.getAttribute('title'),
            el.getAttribute('data-href'),
            el.getAttribute('data-url')
          ].filter(Boolean).join(' '))
          .join('\n');
        return `${visibleText}\n${linkSignals}`;
      });
      const htmlContent = await page.content();
      return searchPatterns(textContent, htmlContent);
    };

    try {
      await tryGoto(formattedUrl, 20000);
    } catch (err) {
      console.warn(`[ContactExtractor] Falha na primeira tentativa para ${formattedUrl}: ${err.message}. Retentando com 45s...`);
      await tryGoto(formattedUrl, 45000);
    }
    
    let contactInfo = await collectSignals();
    let source = 'Home Page';

    if (!contactInfo.email || !contactInfo.telefone) {
      const contactUrl = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        const keywords = [
          'contato', 'contact', 'fale conosco', 'sobre', 'about',
          'quem somos', 'suporte', 'support', 'ajuda', 'help',
          'atendimento', 'onde estamos', 'localiza??o', 'localizacao',
          'whatsapp', 'email', 'e-mail'
        ];
        const contactLink = links.find(el => {
          const text = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').toLowerCase();
          const href = (el.href || el.getAttribute('href') || '').toLowerCase();
          return keywords.some(k => text.includes(k) || href.includes(k)) &&
                 !href.includes('mailto:') && !href.includes('tel:') && !href.includes('wa.me') && !href.includes('whatsapp');
        });
        return contactLink ? contactLink.href : null;
      });

      if (contactUrl && contactUrl !== formattedUrl) {
        try {
          await tryGoto(contactUrl, 20000);
        } catch (err) {
          console.warn(`[ContactExtractor] Falha ao acessar p?gina de contato ${contactUrl}. Retentando com 40s...`);
          await tryGoto(contactUrl, 40000);
        }
        const contactPageInfo = await collectSignals();
        contactInfo = {
          email: contactInfo.email || contactPageInfo.email,
          telefone: contactInfo.telefone || contactPageInfo.telefone,
          emails: [...new Set([...(contactInfo.emails || []), ...(contactPageInfo.emails || [])])],
          telefones: [...new Set([...(contactInfo.telefones || []), ...(contactPageInfo.telefones || [])])]
        };
        source = 'P?gina de Contato';
      }
    }

    if (contactInfo.email || contactInfo.telefone) {
      const emails = contactInfo.emails?.length ? contactInfo.emails : [contactInfo.email].filter(Boolean);
      const telefones = contactInfo.telefones?.length ? contactInfo.telefones : [contactInfo.telefone].filter(Boolean);
      const maxContacts = Math.max(emails.length, telefones.length, 1);
      for (let i = 0; i < maxContacts; i++) {
        await crud.createContato({
          lead_id: leadId,
          email: emails[i] || null,
          telefone: telefones[i] || null,
          fonte: i === 0 ? source : `${source} - EXTRA`
        });
      }
    }

    return { 
      success: true, 
      found: Boolean(contactInfo.email || contactInfo.telefone),
      data: contactInfo 
    };

  } catch (error) {
    console.error('Erro no Service de Contatos / Puppeteer:', error);
    return { success: false, error: error.message };
  } finally {
    if (browser) await browser.close();
  }
}
module.exports = {
  extractPublicContact,
  searchPatterns
};
