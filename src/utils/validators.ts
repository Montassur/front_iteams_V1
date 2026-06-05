export type AuthForm = {
  name: string;
  email: string;
  password: string;
  confirm: string;
  companyName: string;
  registryNumber: string;
};

export function validateAuthForm(mode: 'login' | 'register', form: AuthForm) {
  const e: Partial<AuthForm> = {};
  if (mode === 'register' && !form.name.trim()) e.name = 'Nom requis';
  if (!form.email.includes('@')) e.email = 'Email invalide';
  if (form.password.length < 6) e.password = 'Minimum 6 caractères';
  if (mode === 'register' && form.password !== form.confirm) e.confirm = 'Les mots de passe ne correspondent pas';
  if (mode === 'register' && !form.companyName.trim()) e.companyName = 'Nom de société requis';
  if (mode === 'register' && !form.registryNumber.trim()) e.registryNumber = "Numéro d'immatriculation requis";
  return e;
}


