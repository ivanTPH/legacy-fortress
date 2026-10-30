export type AssetField = {
  id: string
  label: string
  assetTypeId: string
  type: "text" | "number" | "currency" | "date" | "dropdown" | "textarea"
  required: boolean
  placeholder?: string
}

export const ASSET_FIELDS: AssetField[] = [

  // BANK ACCOUNT

  {
    id: "bank-name",
    label: "Bank name",
    assetTypeId: "bank-account",
    type: "text",
    required: true,
    placeholder: "Example: HSBC"
  },

  {
    id: "account-type",
    label: "Account type",
    assetTypeId: "bank-account",
    type: "dropdown",
    required: true
  },

  {
    id: "account-number",
    label: "Account number",
    assetTypeId: "bank-account",
    type: "text",
    required: true
  },

  {
    id: "sort-code",
    label: "Sort code",
    assetTypeId: "bank-account",
    type: "text",
    required: true
  },

  {
    id: "iban",
    label: "IBAN",
    assetTypeId: "bank-account",
    type: "text",
    required: false
  },

  {
    id: "swift",
    label: "SWIFT / BIC",
    assetTypeId: "bank-account",
    type: "text",
    required: false
  },

  {
    id: "balance",
    label: "Current balance",
    assetTypeId: "bank-account",
    type: "currency",
    required: false
  },

  // PROPERTY

  {
    id: "property-address",
    label: "Property address",
    assetTypeId: "property",
    type: "text",
    required: true
  },

  {
    id: "property-value",
    label: "Estimated value",
    assetTypeId: "property",
    type: "currency",
    required: false
  },

  {
    id: "purchase-date",
    label: "Purchase date",
    assetTypeId: "property",
    type: "date",
    required: false
  },

  // VEHICLE

  {
    id: "vehicle-make",
    label: "Make",
    assetTypeId: "vehicle",
    type: "text",
    required: true
  },

  {
    id: "vehicle-model",
    label: "Model",
    assetTypeId: "vehicle",
    type: "text",
    required: true
  },

  {
    id: "vehicle-registration",
    label: "Registration number",
    assetTypeId: "vehicle",
    type: "text",
    required: true
  },

  {
    id: "vehicle-value",
    label: "Estimated value",
    assetTypeId: "vehicle",
    type: "currency",
    required: false
  },

  // POSSESSION

  {
    id: "possession-name",
    label: "Item name",
    assetTypeId: "possession",
    type: "text",
    required: true
  },

  {
    id: "possession-value",
    label: "Estimated value",
    assetTypeId: "possession",
    type: "currency",
    required: false
  },

{
  id: "possession-notes",
  label: "Notes",
  assetTypeId: "possession",
  type: "textarea",
  required: false
},
{
  id: "country",
  label: "Country",
  assetTypeId: "bank-account",
  type: "text",
  required: false
},

{
  id: "currency",
  label: "Currency",
  assetTypeId: "bank-account",
  type: "text",
  required: false
}
]

export function getFieldsByAssetType(assetTypeId: string): AssetField[] {
  return ASSET_FIELDS.filter(field => field.assetTypeId === assetTypeId)
}