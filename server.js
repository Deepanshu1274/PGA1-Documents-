const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const XLSX = require('xlsx');

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
    const tenantDir = path.join(uploadsDir, req.tenantId || `tenant_${Date.now()}`);
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

const assignTenantId = (req, res, next) => {
  req.tenantId = `tenant_${Date.now()}`;
  next();
};

// API endpoint to receive tenant form data
app.post('/api/submit-registration', assignTenantId, (req, res) => {
  // Handle file upload with error handling
  upload.single('aadhaarPdf')(req, res, (err) => {
    if (err) {
      console.error('File upload error:', err);
      return res.status(400).json({
        success: false,
        message: 'File upload error: ' + err.message,
        error: err.message
      });
    }

    try {
      const tenantId = req.tenantId || `tenant_${Date.now()}`;
      
      // Validate required fields
      if (!req.body.fullName || !req.body.mobileNumber || !req.body.aadhaarNumber) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'PDF file is required'
        });
      }

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

      // Save to master JSON file for quick reference
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
        roomNumber: formData.roomNumber,
        submittedAt: formData.submittedAt,
        pdfFile: req.file.filename
      });
      fs.writeFileSync(masterFilePath, JSON.stringify(allRegistrations, null, 2));

      // Save to Excel file
      const excelFilePath = path.join(dataDir, 'Tenant_Data.xlsx');
      let workbook;
      let worksheet;

      // Create or load existing Excel file
      if (fs.existsSync(excelFilePath)) {
        workbook = XLSX.readFile(excelFilePath);
        worksheet = workbook.Sheets[workbook.SheetNames[0]];
      } else {
        // Create new workbook with headers
        worksheet = XLSX.utils.json_to_sheet([]);
        worksheet['A1'] = { t: 's', v: 'Tenant ID' };
        worksheet['B1'] = { t: 's', v: 'Full Name' };
        worksheet['C1'] = { t: 's', v: 'Mobile Number' };
        worksheet['D1'] = { t: 's', v: 'Aadhaar Number' };
        worksheet['E1'] = { t: 's', v: 'Room Number' };
        worksheet['F1'] = { t: 's', v: 'Parent Mobile' };
        worksheet['G1'] = { t: 's', v: 'PDF File' };
        worksheet['H1'] = { t: 's', v: 'Submitted Date' };
        
        workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Tenants');
      }

      // Get existing data
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      // Add new entry
      jsonData.push({
        'Tenant ID': tenantId,
        'Full Name': formData.fullName,
        'Mobile Number': formData.mobileNumber,
        'Aadhaar Number': formData.aadhaarNumber,
        'Room Number': formData.roomNumber,
        'Parent Mobile': formData.parentMobileNumber,
        'PDF File': req.file.filename,
        'Submitted Date': formData.submittedAt
      });

      // Create sheet and add data
      const newWorksheet = XLSX.utils.json_to_sheet(jsonData);
      workbook.Sheets[workbook.SheetNames[0]] = newWorksheet;

      // Write Excel file
      XLSX.writeFile(workbook, excelFilePath);

      console.log(`✅ Tenant ${tenantId} registered successfully`);
      console.log(`📊 Data saved to Excel: ${excelFilePath}`);
      console.log(`📄 PDF saved to: ${req.file.path}`);

      res.json({
        success: true,
        message: 'Tenant registration submitted successfully',
        tenantId: tenantId,
        pdfPath: req.file.path
      });
    } catch (error) {
      console.error('Error processing registration:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing registration: ' + error.message,
        error: error.message
      });
    }
  });
});

// API endpoint to get all tenant data
app.get('/api/all-tenants', (req, res) => {
  try {
    const excelFilePath = path.join(dataDir, 'Tenant_Data.xlsx');
    
    if (!fs.existsSync(excelFilePath)) {
      return res.json({
        success: true,
        data: [],
        message: 'No tenant data yet'
      });
    }

    const workbook = XLSX.readFile(excelFilePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    res.json({
      success: true,
      data: jsonData,
      count: jsonData.length
    });
  } catch (error) {
    console.error('Error fetching tenant data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tenant data',
      error: error.message
    });
  }
});

// API endpoint to download Excel file
app.get('/api/download-excel', (req, res) => {
  try {
    const excelFilePath = path.join(dataDir, 'Tenant_Data.xlsx');
    
    if (!fs.existsSync(excelFilePath)) {
      return res.status(404).json({
        success: false,
        message: 'No Excel file found yet'
      });
    }

    res.download(excelFilePath, 'Tenant_Data.xlsx');
  } catch (error) {
    console.error('Error downloading Excel file:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading file',
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n✅ PGA1 Tenant Registration Server running on http://localhost:${PORT}`);
  console.log(`📁 Data storage: ${dataDir}`);
  console.log(`📄 Forms stored in: ${formsDir}`);
  console.log(`📎 Uploads stored in: ${uploadsDir}`);
  console.log(`📊 Excel file: ${path.join(dataDir, 'Tenant_Data.xlsx')}`);
  console.log(`\n📋 View all tenants at: http://localhost:${PORT}/api/all-tenants`);
  console.log(`⬇️  Download Excel at: http://localhost:${PORT}/api/download-excel\n`);
});
