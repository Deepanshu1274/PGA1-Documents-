const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Create data storage directories if they don't exist
const dataDir = path.join(__dirname, 'owner_data');
const uploadsDir = path.join(dataDir, 'uploads');
const formsDir = path.join(dataDir, 'forms');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(formsDir)) {
  fs.mkdirSync(formsDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tenantDir = path.join(uploadsDir, req.body.tenantId);
    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true });
    }
    cb(null, tenantDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}_${Date.now()}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// API endpoint to receive tenant form data
app.post('/api/submit-registration', upload.single('aadhaarPdf'), (req, res) => {
  try {
    const tenantId = `tenant_${Date.now()}`;
    
    // Prepare form data
    const formData = {
      tenantId: tenantId,
      fullName: req.body.fullName,
      mobileNumber: req.body.mobileNumber,
      roomNumber: req.body.roomNumber,
      aadhaarNumber: req.body.aadhaarNumber,
      parentMobileNumber: req.body.parentMobileNumber,
      permanentAddress: req.body.permanentAddress,
      pdfPassword: req.body.pdfPassword,
      uploadedFile: req.file ? {
        filename: req.file.filename,
        path: req.file.path,
        uploadedAt: new Date().toISOString()
      } : null,
      submittedAt: new Date().toISOString()
    };

    // Save form data to JSON file
    const jsonFilePath = path.join(formsDir, `${tenantId}.json`);
    fs.writeFileSync(jsonFilePath, JSON.stringify(formData, null, 2));

    // Save to master CSV-like file for quick reference
    const masterFilePath = path.join(dataDir, 'all_registrations.json');
    let allRegistrations = [];
    if (fs.existsSync(masterFilePath)) {
      allRegistrations = JSON.parse(fs.readFileSync(masterFilePath, 'utf8'));
    }
    allRegistrations.push({
      tenantId: tenantId,
      fullName: formData.fullName,
      mobileNumber: formData.mobileNumber,
      aadhaarNumber: formData.aadhaarNumber,
      submittedAt: formData.submittedAt
    });
    fs.writeFileSync(masterFilePath, JSON.stringify(allRegistrations, null, 2));

    res.json({
      success: true,
      message: 'Tenant registration submitted successfully',
      tenantId: tenantId
    });
  } catch (error) {
    console.error('Error processing registration:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing registration',
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n✅ PGA1 Tenant Registration Server running on http://localhost:${PORT}`);
  console.log(`📁 Data storage: ${dataDir}`);
  console.log(`📄 Forms stored in: ${formsDir}`);
  console.log(`📎 Uploads stored in: ${uploadsDir}\n`);
});
