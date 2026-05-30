# PGA1 Tenant Registration System

A secure tenant registration system where tenants submit their data and documents, but all data is stored only on the owner's server. Tenants have no access to view their submitted data.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```

The server will run on `http://localhost:3000`

### 3. Access the Form
Open `http://localhost:3000` in your browser to access the tenant registration form.

## Data Storage Structure

All tenant data is stored in the `owner_data/` folder (excluded from git):

```
owner_data/
├── forms/                    # JSON files with tenant registration data
│   ├── tenant_1234567890.json
│   └── tenant_1234567891.json
├── uploads/                  # Uploaded e-Aadhaar PDF files
│   ├── tenant_1234567890/
│   │   └── aadhaarPdf_*.pdf
│   └── tenant_1234567891/
│       └── aadhaarPdf_*.pdf
└── all_registrations.json    # Quick reference index of all submissions
```

## How It Works

1. **Tenant Fills Form**: Tenant enters personal details and uploads their e-Aadhaar PDF
2. **Data Submitted**: All data is sent to the backend server via API (`/api/submit-registration`)
3. **Server Stores Data**: 
   - Form data saved as JSON in `owner_data/forms/`
   - PDF file stored in `owner_data/uploads/`
   - Master index updated in `all_registrations.json`
4. **No Local Storage**: No data is downloaded to the tenant's device
5. **Owner Access Only**: Only the owner can access the `owner_data/` folder

## Security Features

✅ Data stored only on server (not on tenant's device)
✅ Separate folders for forms and uploads
✅ Unique tenant IDs for each submission
✅ Master index for quick reference
✅ PDF validation (only PDF files allowed)

## Owner's Dashboard (Future)

To view tenant data, the owner can access the `owner_data/` folder:
- View form submissions in `forms/` folder
- View uploaded documents in `uploads/` folder
- Check `all_registrations.json` for quick summary
