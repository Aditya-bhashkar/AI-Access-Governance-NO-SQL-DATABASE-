export const VENDOR_OPTIONS = [
  'ChatGPT',
  'Gemini',
  'Claude',
  'Microsoft Copilot',
  'GitHub Copilot',
  'AWS Bedrock',
  'Azure OpenAI',
  'Custom',
]

export const BUSINESS_UNITS = [
  'Engineering',
  'Product',
  'Finance',
  'Marketing',
  'HR',
  'Operations',
  'Legal',
  'Data Science',
  'Customer Success',
  'IT Infrastructure',
]

export const IT_SPOKES = [
  'North America',
  'Europe',
  'Asia Pacific',
  'Middle East',
  'South America',
  'Africa',
  'Global',
]

export const BUSINESS_SPOKES = [
  'Enterprise',
  'SMB',
  'Consumer',
  'Government',
  'Healthcare',
  'Financial Services',
  'Retail',
]

export const STATUS = {
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
  EXPIRING_SOON: 'Expiring Soon',
}

export const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100]
export const EXPIRING_SOON_DAYS = 30

export const TABLE_COLUMNS = [
  { id: 'username', label: 'Username', sortable: true, minWidth: 130 },
  { id: 'applicationName', label: 'Application', sortable: true, minWidth: 160 },
  { id: 'businessUnit', label: 'Business Unit', sortable: true, minWidth: 130 },
  { id: 'itSpoke', label: 'IT Spoke', sortable: true, minWidth: 110 },
  { id: 'businessSpoke', label: 'Business Spoke', sortable: true, minWidth: 130 },
  { id: 'vendor', label: 'Vendor', sortable: true, minWidth: 130 },
  { id: 'dateIssued', label: 'Date Issued', sortable: true, minWidth: 120 },
  { id: 'expiryDate', label: 'Expiry Date', sortable: true, minWidth: 120 },
  { id: 'status', label: 'Status', sortable: false, minWidth: 120 },
  { id: 'actions', label: 'Actions', sortable: false, minWidth: 140, align: 'center' },
]