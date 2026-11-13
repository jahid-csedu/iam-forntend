// Turn off Vite's "any name is allowed" fallback: only the names listed below exist
interface ViteTypeOptions {
  strictImportMetaEnv: unknown
}

// Adds our variables to Vite's built-in description of import.meta.env
interface ImportMetaEnv {
  readonly VITE_IAM_API_BASE_URL: string
}