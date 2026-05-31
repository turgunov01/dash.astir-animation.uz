export type LocaleCode = 'ru' | 'uz' | 'en'

export type LocalizedText = Partial<Record<LocaleCode, string>>

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiErrorInfo {
  code?: string
  message: string
  requestId?: string
  statusCode?: number
  raw?: unknown
}

export interface AuthUser {
  id: string | number
  email?: string
  name?: string
  role?: 'super_admin' | 'admin' | 'parent' | string
  roles?: unknown[]
  active?: boolean
}

export interface SelectOption {
  label: string
  value: string | number | boolean
}

export type FieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'localized'
  | 'json'
  | 'file'

export interface ResourceField {
  key: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  help?: string
  options?: SelectOption[]
  defaultValue?: unknown
  rows?: number
  accept?: string
  send?: boolean
}

export type ColumnKind =
  | 'text'
  | 'localized'
  | 'boolean'
  | 'date'
  | 'status'
  | 'premium'
  | 'number'
  | 'money'
  | 'json'

export interface ResourceColumn {
  key: string
  label: string
  kind?: ColumnKind
}

export interface ResourceFilter {
  key: string
  label: string
  type: 'text' | 'select'
  options?: SelectOption[]
}

export interface EndpointToolDefinition {
  title: string
  description?: string
  endpoint: string
  method: ApiMethod
  fields?: ResourceField[]
  pathParams?: string[]
  danger?: boolean
}

export interface RelatedEndpointDefinition {
  title: string
  description?: string
  endpoint: string
  columns?: ResourceColumn[]
}

export interface ResourceDefinition {
  key: string
  title: string
  description?: string
  listEndpoint?: string
  detailEndpoint?: string
  createEndpoint?: string
  updateEndpoint?: string
  updateMethod?: ApiMethod
  deleteEndpoint?: string
  idKey?: string
  createRoute?: string
  detailRoute?: string
  columns: ResourceColumn[]
  filters?: ResourceFilter[]
  formFields?: ResourceField[]
  related?: RelatedEndpointDefinition[]
  tools?: EndpointToolDefinition[]
  roles?: string[]
}
