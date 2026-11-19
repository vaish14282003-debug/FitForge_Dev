// The seed scripts create accounts on this domain, all with the public password Password123!.
const DEMO_EMAIL_DOMAIN = 'fitforge.dev';

const isDemoAccount = (email) => String(email).toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);

module.exports = { DEMO_EMAIL_DOMAIN, isDemoAccount };
