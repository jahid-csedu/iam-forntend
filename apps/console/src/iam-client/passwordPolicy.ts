// Same as the backend's UserValidator (README section 5). Specials: exactly @ # ! $ % ^ & - + = ( )
export const PASSWORD_POLICY = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[@#!$%^&\-+=()])(?=\S+$).{8,}$/

export const PASSWORD_POLICY_MESSAGE =
  'At least 8 characters with an uppercase letter, a lowercase letter, a digit and one of @ # ! $ % ^ & - + = ( ), and no spaces.'