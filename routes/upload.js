// routes/upload.js
const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const xml2js = require('xml2js');
const upload = require('../middleware/upload');

// Helper function to parse SAML metadata
async function parseSAMLMetadata(filePath) {
  try {
    const xmlData = await fs.readFile(filePath, 'utf8');
    const parser = new xml2js.Parser({ 
      explicitArray: false,
      mergeAttrs: true,
      trim: true 
    });
    
    const result = await parser.parseStringPromise(xmlData);
    
    // Extract common SAML metadata fields
    const entityDescriptor = result.EntityDescriptor || result['md:EntityDescriptor'];
    if (!entityDescriptor) {
      throw new Error('Invalid SAML metadata: EntityDescriptor not found');
    }

    const metadata = {
      entityID: entityDescriptor.entityID,
      validUntil: entityDescriptor.validUntil,
      cacheDuration: entityDescriptor.cacheDuration,
    };

    // Extract IdP SSO Descriptor info
    const idpDescriptor = entityDescriptor.IDPSSODescriptor || entityDescriptor['md:IDPSSODescriptor'];
    if (idpDescriptor) {
      metadata.idpInfo = {
        wantAuthnRequestsSigned: idpDescriptor.WantAuthnRequestsSigned,
        protocolSupportEnumeration: idpDescriptor.protocolSupportEnumeration,
      };

      // Extract Single Sign-On Service endpoints
      const ssoServices = idpDescriptor.SingleSignOnService || idpDescriptor['md:SingleSignOnService'];
      if (ssoServices) {
        metadata.ssoEndpoints = Array.isArray(ssoServices) ? ssoServices : [ssoServices];
        metadata.ssoEndpoints = metadata.ssoEndpoints.map(service => ({
          binding: service.Binding,
          location: service.Location
        }));
      }

      // Extract Single Logout Service endpoints
      const sloServices = idpDescriptor.SingleLogoutService || idpDescriptor['md:SingleLogoutService'];
      if (sloServices) {
        metadata.sloEndpoints = Array.isArray(sloServices) ? sloServices : [sloServices];
        metadata.sloEndpoints = metadata.sloEndpoints.map(service => ({
          binding: service.Binding,
          location: service.Location
        }));
      }

      // Extract Key Descriptors (certificates)
      const keyDescriptors = idpDescriptor.KeyDescriptor || idpDescriptor['md:KeyDescriptor'];
      if (keyDescriptors) {
        metadata.certificates = Array.isArray(keyDescriptors) ? keyDescriptors : [keyDescriptors];
        metadata.certificates = metadata.certificates.map(key => ({
          use: key.use,
          certificate: key.KeyInfo && key.KeyInfo.X509Data && key.KeyInfo.X509Data.X509Certificate
        })).filter(cert => cert.certificate);
      }
    }

    // Extract SP SSO Descriptor info (if it's SP metadata)
    const spDescriptor = entityDescriptor.SPSSODescriptor || entityDescriptor['md:SPSSODescriptor'];
    if (spDescriptor) {
      metadata.spInfo = {
        authnRequestsSigned: spDescriptor.AuthnRequestsSigned,
        wantAssertionsSigned: spDescriptor.WantAssertionsSigned,
        protocolSupportEnumeration: spDescriptor.protocolSupportEnumeration,
      };

      // Extract Assertion Consumer Service endpoints
      const acsServices = spDescriptor.AssertionConsumerService || spDescriptor['md:AssertionConsumerService'];
      if (acsServices) {
        metadata.acsEndpoints = Array.isArray(acsServices) ? acsServices : [acsServices];
        metadata.acsEndpoints = metadata.acsEndpoints.map(service => ({
          binding: service.Binding,
          location: service.Location,
          index: service.index,
          isDefault: service.isDefault
        }));
      }
    }

    return metadata;
  } catch (error) {
    throw new Error(`Failed to parse SAML metadata: ${error.message}`);
  }
}

// Upload and parse SAML metadata file
router.post('/saml-metadata', upload.single('metadata'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No metadata file uploaded',
        message: 'Please select a SAML metadata XML file to upload'
      });
    }

    // Validate file type
    const allowedExtensions = ['.xml', '.txt'];
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension)) {
      // Clean up uploaded file
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({
        error: 'Invalid file type',
        message: 'Only XML files are allowed for SAML metadata'
      });
    }

    // Parse the SAML metadata
    const parsedMetadata = await parseSAMLMetadata(req.file.path);

    // Clean up the uploaded file after parsing
    await fs.unlink(req.file.path).catch(() => {});

    res.json({
      message: 'SAML metadata uploaded and parsed successfully',
      filename: req.file.originalname,
      metadata: parsedMetadata
    });

  } catch (error) {
    // Clean up uploaded file on error
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }

    console.error('SAML metadata upload error:', error);
    res.status(500).json({
      error: 'Failed to process SAML metadata',
      message: error.message
    });
  }
});

// Get upload form (optional - for testing)
router.get('/form', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>SAML Metadata Upload</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .form-group { margin-bottom: 20px; }
            label { display: block; margin-bottom: 5px; font-weight: bold; }
            input[type="file"] { padding: 10px; border: 1px solid #ddd; border-radius: 4px; width: 100%; }
            button { background-color: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
            button:hover { background-color: #0056b3; }
            .info { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
        </style>
    </head>
    <body>
        <h1>Upload SAML Metadata</h1>
        <div class="info">
            <p><strong>Supported formats:</strong> XML files containing SAML 2.0 metadata</p>
            <p><strong>What will be extracted:</strong> Entity ID, SSO endpoints, certificates, and other SAML configuration data</p>
        </div>
        <form action="/upload/saml-metadata" method="post" enctype="multipart/form-data">
            <div class="form-group">
                <label for="metadata">Select SAML Metadata File:</label>
                <input type="file" id="metadata" name="metadata" accept=".xml,.txt" required>
            </div>
            <button type="submit">Upload and Parse</button>
        </form>
    </body>
    </html>
  `);
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'SAML Metadata Upload Service',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
