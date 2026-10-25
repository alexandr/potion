// Product name by domain: the same build is served as Potion (potion.page) and Snotion (snotion.com)
export const BRAND = /(^|\.)snotion\.com$/.test(location.hostname) ? 'Snotion' : 'Potion';
export const DOMAIN = BRAND === 'Snotion' ? 'snotion.com' : 'potion.page';
