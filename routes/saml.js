const express = require('express');
const generateServiceProviderMetadata = require('passport-saml-metadata');

module.exports = function(samlConfig) {
  const router = express.Router();

  router.get('/metadata', (req, res) => {
    if (!samlConfig || !samlConfig.cert) {
      return res.status(500).send('SAML not configured');
    }

    const metadata = generateServiceProviderMetadata(
      samlConfig.callbackUrl,
      samlConfig.cert
    );
    res.type('application/xml').send(metadata);
  });

  return router;
};

